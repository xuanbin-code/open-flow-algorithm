mod python_bridge;

use python_bridge::PythonBridge;
use serde_json::Value;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

/// Shared application state holding the Python backend bridge.
struct AppState {
    python_bridge: Arc<Mutex<Option<PythonBridge>>>,
    python_path: String,
    script_dir: String,
}

/// Start the Python backend subprocess.
///
/// Returns `true` if the backend started successfully or was already running.
#[tauri::command]
async fn start_python_backend(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let mut bridge_guard = state.python_bridge.lock().await;
    if bridge_guard.is_some() {
        // Check if the existing bridge is still alive
        // We can't easily call is_alive() through the Arc<Mutex<Option<...>>>,
        // so we'll just return true for now — the frontend can detect failures
        // via failed send_python_command calls
        return Ok(true);
    }

    match PythonBridge::new(&state.python_path, &state.script_dir).await {
        Ok(bridge) => {
            *bridge_guard = Some(bridge);
            Ok(true)
        }
        Err(e) => Err(e),
    }
}

/// Stop the Python backend subprocess gracefully.
#[tauri::command]
async fn stop_python_backend(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut bridge_guard = state.python_bridge.lock().await;
    if let Some(bridge) = bridge_guard.take() {
        bridge.shutdown().await;
    }
    Ok(())
}

/// Send a JSON-RPC command to the Python backend and return the response.
///
/// # Arguments
/// * `method` - The RPC method name (e.g., "load_program", "step", "run").
/// * `params` - Optional JSON parameters for the method.
///
/// Returns the JSON-RPC response result on success, or an error on failure.
#[tauri::command]
async fn send_python_command(
    method: String,
    params: Option<Value>,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    let bridge_guard = state.python_bridge.lock().await;
    let bridge = bridge_guard
        .as_ref()
        .ok_or_else(|| "Python backend is not running. Call start_python_backend first.".to_string())?;

    let response = bridge.call(&method, params).await?;

    if let Some(err) = response.error {
        return Err(format!(
            "Python backend error [code {}]: {}",
            err.code, err.message
        ));
    }

    Ok(response.result.unwrap_or(Value::Null))
}

/// Check whether the Python backend is currently running.
#[tauri::command]
async fn python_backend_status(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let bridge_guard = state.python_bridge.lock().await;
    match bridge_guard.as_ref() {
        Some(bridge) => Ok(bridge.is_alive().await),
        None => Ok(false),
    }
}

/// Get the default Python path and script directory based on the app's resource directory.
///
/// In production (bundled), Python is embedded alongside the app resources.
/// In development, we look for `python-backend/` relative to the app directory.
#[allow(unused_variables)]
fn resolve_python_paths(app_handle: &tauri::AppHandle) -> (String, String) {
    // In dev mode (debug_assertions), use system python and the project's python-backend/ directory.
    // In release mode, use the bundled Python in the app resources.
    #[cfg(debug_assertions)]
    let (python_path, script_dir) = {
        // In dev mode, use system python and the project's python-backend/ directory.
        // CARGO_MANIFEST_DIR is a compile-time macro → always available, always correct.
        // From src-tauri/ → ../python-backend reaches the app/ directory.
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let script_dir = std::path::PathBuf::from(manifest_dir)
            .join("..")
            .join("python-backend");

        // Verify the resolved directory actually exists
        if !script_dir.exists() {
            eprintln!(
                "[python-bridge] WARNING: python-backend directory not found at {}",
                script_dir.display()
            );
        }

        let python_path = if cfg!(target_os = "windows") {
            "python".to_string()
        } else {
            "python3".to_string()
        };

        (python_path, script_dir.to_string_lossy().to_string())
    };

    #[cfg(not(debug_assertions))]
    let (python_path, script_dir) = {
        // In production, use the bundled Python in the app resources
        let resource_dir = app_handle
            .path()
            .resource_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."));

        let python_exe = if cfg!(target_os = "windows") {
            resource_dir.join("python").join("python.exe")
        } else if cfg!(target_os = "macos") {
            resource_dir.join("python").join("bin").join("python3")
        } else {
            resource_dir.join("python").join("bin").join("python3")
        };

        let script_dir = resource_dir.join("python-backend");

        (
            python_exe.to_string_lossy().to_string(),
            script_dir.to_string_lossy().to_string(),
        )
    };

    (python_path, script_dir)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let (python_path, script_dir) = resolve_python_paths(app.handle());
            app.manage(AppState {
                python_bridge: Arc::new(Mutex::new(None)),
                python_path,
                script_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_python_backend,
            stop_python_backend,
            send_python_command,
            python_backend_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
