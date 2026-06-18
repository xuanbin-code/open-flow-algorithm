use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, oneshot, Mutex};

/// A JSON-RPC 2.0 request sent to the Python backend.
#[derive(Debug, Clone, Serialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

/// A JSON-RPC 2.0 response received from the Python backend.
#[derive(Debug, Clone, Deserialize)]
pub struct JsonRpcResponse {
    #[allow(dead_code)]
    pub jsonrpc: String,
    pub id: u64,
    #[serde(default)]
    pub result: Option<Value>,
    #[serde(default)]
    pub error: Option<JsonRpcError>,
}

/// A JSON-RPC 2.0 error object.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

/// Maps pending request IDs to their response channels.
type PendingResponses = Arc<Mutex<HashMap<u64, oneshot::Sender<JsonRpcResponse>>>>;

/// Manages the lifecycle and communication with the Python backend subprocess.
///
/// Communication uses newline-delimited JSON (JSON-lines) over stdin/stdout:
/// - Requests are written as one JSON line to stdin
/// - Responses are read as one JSON line from stdout
///
/// The Python process runs `main.py` inside the configured script directory.
pub struct PythonBridge {
    /// Channel to send request JSON strings to the stdin writer task.
    stdin_tx: mpsc::Sender<String>,
    /// Shared counter for generating unique request IDs.
    next_id: Arc<Mutex<u64>>,
    /// Map of pending requests awaiting responses.
    pending: PendingResponses,
    /// Handle to the child process (held to keep it alive, checked for exit status).
    child: Arc<Mutex<Option<Child>>>,
    /// Track whether the backend was successfully started (future use: health recovery).
    #[allow(dead_code)]
    started: Arc<Mutex<bool>>,
}

impl PythonBridge {
    /// Create a new PythonBridge and start the Python backend subprocess.
    ///
    /// # Arguments
    /// * `python_path` - Path to the Python interpreter binary (e.g., "python3" or embedded path).
    /// * `script_dir` - Directory containing `main.py` and the `flowgorithm/` package.
    pub async fn new(python_path: &str, script_dir: &str) -> Result<Self, String> {
        // Spawn the Python subprocess with unbuffered stdout
        let mut child = Command::new(python_path)
            .arg("-u") // unbuffered stdout — ensures line-by-line JSON delivery
            .arg("main.py")
            .current_dir(script_dir)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("Failed to start Python backend ({}): {}", python_path, e))?;

        let child_stdin = child.stdin.take().ok_or("Failed to capture Python stdin")?;
        let child_stdout = child.stdout.take().ok_or("Failed to capture Python stdout")?;

        // Channel: requests flow from callers into the stdin writer task
        let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(64);

        let pending: PendingResponses = Arc::new(Mutex::new(HashMap::new()));
        let pending_for_reader = pending.clone();

        // ---- Stdin writer task ----
        let mut stdin_writer = child_stdin;
        tokio::spawn(async move {
            while let Some(line) = stdin_rx.recv().await {
                if stdin_writer.write_all(line.as_bytes()).await.is_err() {
                    break;
                }
                if stdin_writer.write_all(b"\n").await.is_err() {
                    break;
                }
            }
        });

        // ---- Stdout reader task ----
        let stdout_reader = BufReader::new(child_stdout);
        tokio::spawn(async move {
            let mut lines = stdout_reader.lines();
            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => {
                        if line.trim().is_empty() {
                            continue;
                        }
                        match serde_json::from_str::<JsonRpcResponse>(&line) {
                            Ok(response) => {
                                let id = response.id;
                                let mut map = pending_for_reader.lock().await;
                                if let Some(sender) = map.remove(&id) {
                                    let _ = sender.send(response);
                                }
                                // Responses with no matching sender are dropped
                                // (e.g., stale responses after timeout or from a previous run)
                            }
                            Err(e) => {
                                eprintln!(
                                    "[python-bridge] Failed to parse JSON response: {} — raw: {}",
                                    e, line
                                );
                            }
                        }
                    }
                    Ok(None) => {
                        // stdout closed — Python process exited
                        break;
                    }
                    Err(e) => {
                        eprintln!("[python-bridge] Stdout read error: {}", e);
                        break;
                    }
                }
            }
        });

        Ok(Self {
            stdin_tx,
            next_id: Arc::new(Mutex::new(1)),
            pending,
            child: Arc::new(Mutex::new(Some(child))),
            started: Arc::new(Mutex::new(true)),
        })
    }

    /// Send a JSON-RPC request and wait for the matching response.
    ///
    /// # Arguments
    /// * `method` - The JSON-RPC method name (e.g., "load_program", "step", "run").
    /// * `params` - Optional parameters for the method.
    ///
    /// Returns the response from the Python backend, or an error if communication fails.
    pub async fn call(
        &self,
        method: &str,
        params: Option<Value>,
    ) -> Result<JsonRpcResponse, String> {
        let id = {
            let mut next = self.next_id.lock().await;
            let current = *next;
            *next = current.wrapping_add(1);
            current
        };

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.to_string(),
            params,
        };

        let request_json =
            serde_json::to_string(&request).map_err(|e| format!("Serialize error: {}", e))?;

        // Create a oneshot channel to receive the response
        let (tx, rx) = oneshot::channel();
        {
            let mut pending_map = self.pending.lock().await;
            pending_map.insert(id, tx);
        }

        // Send the request via the stdin channel
        self.stdin_tx
            .send(request_json)
            .await
            .map_err(|e| format!("Failed to send request to Python backend: {}", e))?;

        // Wait for the response (with a 30-second timeout)
        match tokio::time::timeout(std::time::Duration::from_secs(30), rx).await {
            Ok(Ok(response)) => Ok(response),
            Ok(Err(_)) => {
                // oneshot sender was dropped — clean up our pending entry
                let mut pending_map = self.pending.lock().await;
                pending_map.remove(&id);
                Err("Python backend closed the connection".to_string())
            }
            Err(_) => {
                // Timeout — clean up
                let mut pending_map = self.pending.lock().await;
                pending_map.remove(&id);
                Err(format!(
                    "Timeout waiting for response from Python backend (method: {})",
                    method
                ))
            }
        }
    }

    /// Check whether the Python backend process is still running.
    pub async fn is_alive(&self) -> bool {
        let mut child_guard = self.child.lock().await;
        if let Some(ref mut child) = *child_guard {
            match child.try_wait() {
                Ok(None) => true,  // still running
                Ok(Some(status)) => {
                    eprintln!("[python-bridge] Python process exited with: {:?}", status);
                    *child_guard = None;
                    false
                }
                Err(e) => {
                    eprintln!("[python-bridge] Error checking process status: {}", e);
                    false
                }
            }
        } else {
            false
        }
    }

    /// Gracefully shut down the Python backend.
    ///
    /// Sends a "shutdown" request, then kills the process if it doesn't exit within 2 seconds.
    pub async fn shutdown(&self) {
        // Send a graceful shutdown request
        let _ = self.call("shutdown", None).await;

        // Force kill after a timeout
        let child_arc = self.child.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            let mut child_guard = child_arc.lock().await;
            if let Some(ref mut child) = *child_guard {
                let _ = child.kill().await;
            }
            *child_guard = None;
        });
    }
}

impl Drop for PythonBridge {
    fn drop(&mut self) {
        // Note: Drop cannot be async, so we can't gracefully shut down here.
        // The kill_on_drop(true) on the child process ensures the Python process
        // is terminated when PythonBridge is dropped.
    }
}
