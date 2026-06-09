# Tauri - Start

**Pages:** 15

---

## Create a Project | Tauri

**URL:** https://tauri.app/start/create-project/

**Contents:**
- Create a Project
- Using create-tauri-app
    - Scaffold a new project
    - Start the development server
- Manual Setup (Tauri CLI)
- Next Steps

One thing that makes Tauri so flexible is its ability to work with virtually any frontend framework. We’ve created the create-tauri-app utility to help you create a new Tauri project using one of the officially maintained framework templates.

create-tauri-app currently includes templates for vanilla (HTML, CSS and JavaScript without a framework), Vue.js, Svelte, React, SolidJS, Angular, Preact, Yew, Leptos, and Sycamore. You can also find or add your own community templates and frameworks in the Awesome Tauri repo.

Alternatively, you can add Tauri to an existing project to quickly turn your existing codebase into a Tauri app.

To get started using create-tauri-app run one of the below commands in the folder you’d like to setup your project. If you’re not sure which command to use we recommend the Bash command on Linux and macOS and the PowerShell command on Windows.

Follow along with the prompts to choose your project name, frontend language, package manager, and frontend framework, and frontend framework options if applicable.

Not sure what to choose?

We recommend starting with the vanilla template (HTML, CSS, and JavaScript without a frontend framework) to get started. You can always integrate a frontend framework later.

Choose a name and a bundle identifier (unique-id for your app):

Select a flavor for your frontend. First the language:

Select a package manager (if there are multiple available):

Options for TypeScript / JavaScript:

Select a UI Template and flavor (if there are multiple available):

Options for TypeScript / JavaScript:

Once completed, the utility reports that the template has been created and displays how to run it using the configured package manager. If it detects missing dependencies on your system, it prints a list of packages and prompts how to install them.

After create-tauri-app has completed, you can navigate into your project’s folder, install dependencies, and then use the Tauri CLI to start the development server:

You’ll now see a new window open with your app running.

Congratulations! You’ve made your Tauri app! 🚀

If you already have an existing frontend or prefer to set it up yourself, you can use the Tauri CLI to initialize the backend for your project separately.

The following example assumes you are creating a new project. If you’ve already initialized the frontend of your application, you can skip the first step.

Create a new directory for your project and initialize the frontend. You can use plain HTML, CSS, and JavaScript, or any framework you prefer such as Next.js, Nuxt, Svelte, Yew, or Leptos. You just need a way of serving the app in your browser. Just as an example, this is how you would setup a simple Vite app:

Then, install Tauri’s CLI tool using your package manager of choice. If you are using cargo to install the Tauri CLI, you will have to install it globally.

Determine the URL of your frontend development server. This is the URL that Tauri will use to load your content. For example, if you are using Vite, the default URL is http://localhost:5173.

In your project directory, initialize Tauri:

After running the command it will display a prompt asking you for different options:

This will create a src-tauri directory in your project with the necessary Tauri configuration files.

Verify your Tauri app is working by running the development server:

This command will compile the Rust code and open a window with your web content.

Congratulations! You’ve created a new Tauri project using the Tauri CLI! 🚀

Last updated: Apr 2, 2026

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (unknown):
```unknown
sh <(curl https://create.tauri.app/sh)
```

Example 2 (unknown):
```unknown
irm https://create.tauri.app/ps | iex
```

Example 3 (unknown):
```unknown
sh (curl -sSL https://create.tauri.app/sh | psub)
```

Example 4 (elixir):
```elixir
npm create tauri-app@latest
```

---

## Frontend Configuration | Tauri

**URL:** https://tauri.app/start/frontend/

**Contents:**
- Frontend Configuration
- Configuration Checklist
- JavaScript
- Rust

Tauri is frontend agnostic and supports most frontend frameworks out of the box. However, sometimes a framework need a bit of extra configuration to integrate with Tauri. Below is a list of frameworks with recommended configurations.

If a framework is not listed then it may work with Tauri with no additional configuration needed or it could have not been documented yet. Any contributions to add a framework that may require additional configuration are welcome to help others in the Tauri community.

Conceptually Tauri acts as a static web host. You need to provide Tauri with a folder containing some mix of HTML, CSS, Javascript and possibly WASM that can be served to the webview Tauri provides.

Below is a checklist of common scenarios needed to integrate a frontend with Tauri:

For most projects we recommend Vite for SPA frameworks such as React, Vue, Svelte, and Solid, but also for plain JavaScript or TypeScript projects. Most other guides listed here show how to use Meta-Frameworks as they are typically designed for SSR and therefore require special configuration.

Framework Not Listed?

Don’t see a framework listed? It may work with Tauri without any additional configuration required. Read the configuration checklist for any common configurations to check for.

Last updated: Oct 1, 2024

© 2026 Tauri Contributors. CC-BY / MIT

---

## Leptos | Tauri

**URL:** https://tauri.app/start/frontend/leptos/

**Contents:**
- Leptos
- Checklist
- Example Configuration
      - Update Tauri configuration
      - Update Trunk configuration

Leptos is a Rust based web framework. You can read more about Leptos on their official website. This guide is accurate as of Leptos version 0.6.

Last updated: Feb 22, 2025

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (json):
```json
{  "build": {    "beforeDevCommand": "trunk serve",    "devUrl": "http://localhost:1420",    "beforeBuildCommand": "trunk build",    "frontendDist": "../dist"  },  "app": {    "withGlobalTauri": true  }}
```

Example 2 (json):
```json
[build]target = "./index.html"
[watch]ignore = ["./src-tauri"]
[serve]port = 1420open = falsews_protocol = "ws"
```

---

## Next.js | Tauri

**URL:** https://tauri.app/start/frontend/nextjs/

**Contents:**
- Next.js
- Checklist
- Example Configuration
      - Update Tauri configuration
      - Update Next.js configuration
      - Update package.json configuration

Next.js is a meta framework for React. Learn more about Next.js at https://nextjs.org. This guide is accurate as of Next.js 14.2.3.

Last updated: May 29, 2026

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (json):
```json
{  "build": {    "beforeDevCommand": "npm run dev",    "beforeBuildCommand": "npm run build",    "devUrl": "http://localhost:3000",    "frontendDist": "../out"  }}
```

Example 2 (json):
```json
{  "build": {    "beforeDevCommand": "yarn dev",    "beforeBuildCommand": "yarn build",    "devUrl": "http://localhost:3000",    "frontendDist": "../out"  }}
```

Example 3 (json):
```json
{  "build": {    "beforeDevCommand": "pnpm dev",    "beforeBuildCommand": "pnpm build",    "devUrl": "http://localhost:3000",    "frontendDist": "../out"  }}
```

Example 4 (json):
```json
{  "build": {    "beforeDevCommand": "deno task dev",    "beforeBuildCommand": "deno task build",    "devUrl": "http://localhost:3000",    "frontendDist": "../out"  }}
```

---

## Nuxt | Tauri

**URL:** https://tauri.app/start/frontend/nuxt/

**Contents:**
- Nuxt
- Checklist
- Example Configuration
      - Update Tauri configuration
      - Update Nuxt configuration

Nuxt is a meta framework for Vue. Learn more about Nuxt at https://nuxt.com. This guide is accurate as of Nuxt 4.2.

Last updated: Dec 16, 2025

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (json):
```json
{  "build": {    "beforeDevCommand": "npm run dev",    "beforeBuildCommand": "npm run generate",    "devUrl": "http://localhost:3000",    "frontendDist": "../dist"  }}
```

Example 2 (json):
```json
{  "build": {    "beforeDevCommand": "yarn dev",    "beforeBuildCommand": "yarn generate",    "devUrl": "http://localhost:3000",    "frontendDist": "../dist"  }}
```

Example 3 (json):
```json
{  "build": {    "beforeDevCommand": "pnpm dev",    "beforeBuildCommand": "pnpm generate",    "devUrl": "http://localhost:3000",    "frontendDist": "../dist"  }}
```

Example 4 (json):
```json
{  "build": {    "beforeDevCommand": "deno task dev",    "beforeBuildCommand": "deno task generate",    "devUrl": "http://localhost:3000",    "frontendDist": "../dist"  }}
```

---

## Prerequisites | Tauri

**URL:** https://tauri.app/start/prerequisites/

**Contents:**
- Prerequisites
- System Dependencies
  - Linux
  - macOS
  - Windows
    - Microsoft C++ Build Tools
    - WebView2
    - VBSCRIPT (for MSI installers)
- Rust
- Node.js

In order to get started building your project with Tauri you’ll first need to install a few dependencies:

Follow the link to get started for your respective operating system:

Tauri requires various system dependencies for development on Linux. These may be different depending on your distribution but we’ve included some popular distributions below to help you get setup.

Note: Alpine Linux containers don’t include any fonts by default. To ensure text renders correctly in your Tauri app, install at least one font package (for example, font-dejavu ).

Instructions for Nix/NixOS can be found in the NixOS Wiki.

If your distribution isn’t included above then you may want to check Awesome Tauri on GitHub to see if a guide has been created.

Tauri uses Xcode and various macOS and iOS development dependencies.

Download and install Xcode from one of the following places:

Be sure to launch Xcode after installing so that it can finish setting up.

Only developing for desktop targets? If you’re only planning to develop desktop apps and not targeting iOS then you can install Xcode Command Line Tools instead:

Tauri uses the Microsoft C++ Build Tools for development as well as Microsoft Edge WebView2. These are both required for development on Windows.

Follow the steps below to install the required dependencies.

Next: Install WebView2.

WebView 2 is already installed on Windows 10 (from version 1803 onward) and later versions of Windows. If you are developing on one of these versions then you can skip this step and go directly to installing Rust.

Tauri uses Microsoft Edge WebView2 to render content on Windows.

Install WebView2 by visiting the WebView2 Runtime download section. Download the “Evergreen Bootstrapper” and install it.

MSI package building only

This is only required if you plan to build MSI installer packages ("targets": "msi" or "targets": "all" in tauri.conf.json).

Building MSI packages on Windows requires the VBSCRIPT optional feature to be enabled. This feature is enabled by default on most Windows installations, but may have been disabled on some systems.

If you encounter errors like failed to run light.exe when building MSI packages, you may need to enable the VBSCRIPT feature:

Note: VBSCRIPT is currently enabled by default on most Windows installations, but is being deprecated and may be disabled in future Windows versions.

Tauri is built with Rust and requires it for development. Install Rust using one of following methods. You can view more installation methods at https://www.rust-lang.org/tools/install.

Install via rustup using the following command:

We have audited this bash script, and it does what it says it is supposed to do. Nevertheless, before blindly curl-bashing a script, it is always wise to look at it first.

Here is the file as a plain script: rustup.sh

Visit https://www.rust-lang.org/tools/install to install rustup.

Alternatively, you can use winget to install rustup using the following command in PowerShell:

MSVC toolchain as default

For full support for Tauri and tools like trunk make sure the MSVC Rust toolchain is the selected default host triple in the installer dialog. Depending on your system it should be either x86_64-pc-windows-msvc, i686-pc-windows-msvc, or aarch64-pc-windows-msvc.

If you already have Rust installed, you can make sure the correct toolchain is installed by running this command:

Be sure to restart your Terminal (and in some cases your system) for the changes to take effect.

Next: Configure for Mobile Targets if you’d like to build for Android and iOS, or, if you’d like to use a JavaScript framework, install Node. Otherwise Create a Project.

Only if you intend to use a JavaScript frontend framework

It’s important to restart your Terminal to ensure it recognizes the new installation. In some cases, you might need to restart your computer.

While npm is the default package manager for Node.js, you can also use others like pnpm or yarn. To enable these, run corepack enable in your Terminal. This step is optional and only needed if you prefer using a package manager other than npm.

Next: Configure for Mobile Targets or Create a project.

If you’d like to target your app for Android or iOS then there are a few additional dependencies that you need to install:

Selecting “Show Package Details” in the SDK Manager enables the installation of older package versions. Only install older versions if necessary, as they may introduce compatibility issues or security risks.

Most apps don’t refresh their environment variables automatically, so to let them pickup the changes, you can either restart your terminal and IDE or for your current PowerShell session, you can refresh it with

Next: Setup for iOS or Create a project.

iOS development requires Xcode and is only available on macOS. Be sure that you’ve installed Xcode and not Xcode Command Line Tools in the macOS system dependencies section.

Next: Create a project.

If you run into any issues during installation be sure to check the Troubleshooting Guide or reach out on the Tauri Discord.

Now that you’ve installed all of the prerequisites you’re ready to create your first Tauri project!

Last updated: Mar 30, 2026

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (unknown):
```unknown
sudo apt updatesudo apt install libwebkit2gtk-4.1-dev \  build-essential \  curl \  wget \  file \  libxdo-dev \  libssl-dev \  libayatana-appindicator3-dev \  librsvg2-dev
```

Example 2 (unknown):
```unknown
sudo pacman -Syusudo pacman -S --needed \  webkit2gtk-4.1 \  base-devel \  curl \  wget \  file \  openssl \  appmenu-gtk-module \  libappindicator-gtk3 \  librsvg \  xdotool
```

Example 3 (unknown):
```unknown
sudo dnf check-updatesudo dnf install webkit2gtk4.1-devel \  openssl-devel \  curl \  wget \  file \  libappindicator-gtk3-devel \  librsvg2-devel \  libxdo-develsudo dnf group install "c-development"
```

Example 4 (json):
```json
sudo emerge --ask \  net-libs/webkit-gtk:4.1 \  dev-libs/libayatana-appindicator \  net-misc/curl \  net-misc/wget \  sys-apps/file
```

---

## Project Structure | Tauri

**URL:** https://tauri.app/start/project-structure/

**Contents:**
- Project Structure
- Next Steps

A Tauri project is usually made of 2 parts, a Rust project and a JavaScript project (optional), and typically the setup looks something like this:

In this case, the JavaScript project is at the top level, and the Rust project is inside src-tauri/, the Rust project is a normal Cargo project with some extra files:

Tauri works similar to a static web host, and the way it builds is that you would compile your JavaScript project to static files first, and then compile the Rust project that will bundle those static files in, so the JavaScript project setup is basically the same as if you were to build a static website, to learn more, see Frontend Configuration

If you want to work with Rust code only, simply remove everything else and use the src-tauri/ folder as your top level project or as a member of your Rust workspace

Last updated: Sep 26, 2025

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (unknown):
```unknown
.├── package.json├── index.html├── src/│   ├── main.js├── src-tauri/│   ├── Cargo.toml│   ├── Cargo.lock│   ├── build.rs│   ├── tauri.conf.json│   ├── src/│   │   ├── main.rs│   │   └── lib.rs│   ├── icons/│   │   ├── icon.png│   │   ├── icon.icns│   │   └── icon.ico│   └── capabilities/│       └── default.json
```

---

## Qwik | Tauri

**URL:** https://tauri.app/start/frontend/qwik/

**Contents:**
- Qwik
- Checklist
- Example Configuration
      - Create a new Qwik app
      - Install the static adapter
      - Add the Tauri CLI to your project
      - Initiate a new Tauri project
      - Tauri configuration
      - Start your tauri app

This guide will walk you through creating your Tauri app using the Qwik web framework. Learn more about Qwik at https://qwik.dev.

Last updated: Nov 1, 2024

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (elixir):
```elixir
npm create qwik@latestcd <PROJECT>
```

Example 2 (elixir):
```elixir
yarn create qwik@latestcd <PROJECT>
```

Example 3 (elixir):
```elixir
pnpm create qwik@latestcd <PROJECT>
```

Example 4 (elixir):
```elixir
deno run -A npm:create-qwik@latestcd <PROJECT>
```

---

## SvelteKit | Tauri

**URL:** https://tauri.app/start/frontend/sveltekit/

**Contents:**
- SvelteKit
- Checklist
- Example Configuration
      - Install @sveltejs/adapter-static
      - Update Tauri configuration
      - Update SvelteKit configuration:
      - Disable SSR

SvelteKit is a meta framework for Svelte. Learn more about SvelteKit at https://svelte.dev/. This guide is accurate as of SvelteKit 2.20.4 / Svelte 5.25.8.

Lastly, we need to disable SSR by adding a root +layout.ts file (or +layout.js if you are not using TypeScript) with these contents:

Note that static-adapter doesn’t require you to disable SSR for the whole app but it makes it possible to use APIs that depend on the global window object (like Tauri’s API) without Client-side checks.

Furthermore, if you prefer Static Site Generation (SSG) over Single-Page Application (SPA) mode, you can change the adapter configurations and +layout.ts according to the adapter docs.

Last updated: Jul 5, 2025

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (elixir):
```elixir
npm install --save-dev @sveltejs/adapter-static
```

Example 2 (elixir):
```elixir
yarn add -D @sveltejs/adapter-static
```

Example 3 (elixir):
```elixir
pnpm add -D @sveltejs/adapter-static
```

Example 4 (elixir):
```elixir
deno add -D npm:@sveltejs/adapter-static
```

---

## Trunk | Tauri

**URL:** https://tauri.app/start/frontend/trunk/

**Contents:**
- Trunk
- Checklist
- Example Configuration
      - Update Tauri configuration
      - Update Trunk configuration

Trunk is a WASM web application bundler for Rust. Learn more about Trunk at https://trunk-rs.github.io/trunk/. This guide is accurate as of Trunk 0.17.5.

Last updated: Feb 2, 2026

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (json):
```json
{  "build": {    "beforeDevCommand": "trunk serve",    "beforeBuildCommand": "trunk build",    "devUrl": "http://localhost:8080",    "frontendDist": "../dist"  },  "app": {    "withGlobalTauri": true  }}
```

Example 2 (json):
```json
[watch]ignore = ["./src-tauri"]
[serve]ws_protocol = "ws"
```

---

## Upgrade from Tauri 1.0 | Tauri

**URL:** https://tauri.app/start/migrate/from-tauri-1/

**Contents:**
- Upgrade from Tauri 1.0
- Preparing for Mobile
- Automated Migration
- Summary of Changes
  - Tauri Configuration
  - New Cargo Features
  - Removed Cargo Features
  - Rust Crate Changes
  - JavaScript API Changes
  - Environment Variables Changes

This guide walks you through upgrading your Tauri 1.0 application to Tauri 2.0.

The mobile interface of Tauri requires your project to output a shared library. If you are targeting mobile for your existing application, you must change your crate to produce that kind of artifact along with the desktop executable.

Rename src-tauri/src/main.rs to src-tauri/src/lib.rs. This file will be shared by both desktop and mobile targets.

Rename the main function header in lib.rs to the following:

The tauri::mobile_entry_point macro prepares your function to be executed on mobile.

This command is not a substitude for this guide! Please read the whole page regardless of whether you chose to use the command.

The Tauri v2 CLI includes a migrate command that automates most of the process and helps you finish the migration:

Learn more about the migrate command in the Command Line Interface reference

Below is a summary of the changes from Tauri 1.0 to Tauri 2.0:

Tauri 2.0 Configuration API reference

The @tauri-apps/api package no longer provides non-core modules. Only the previous tauri (now core), path, event and window modules are exported. All others have been moved to plugins.

The v1 plugins are now published as @tauri-apps/plugin-<plugin-name>. Previously they were available from git as tauri-plugin-<plugin-name>-api.

Most of the environment variables read and written by the Tauri CLI were renamed for consistency and prevention of mistakes:

The event system was redesigned to be easier to use. Instead of relying on the source of the event, it now has a simpler implementation that relies on event targets.

Tauri v2 introduces multiwebview support currently behind an unstable feature flag. In order to support it, we renamed the Rust Window type to WebviewWindow and the Manager get_window function to get_webview_window.

The WebviewWindow JS API type is now re-exported from @tauri-apps/api/webviewWindow instead of @tauri-apps/api/window.

On Windows the frontend files in production apps are now hosted on http://tauri.localhost instead of https://tauri.localhost. Because of this IndexedDB, LocalStorage and Cookies will be reset unless dangerousUseHttpScheme was used in v1. To prevent this you can set app > windows > useHttpsScheme to true or use WebviewWindowBuilder::use_https_scheme to keep using the https scheme.

Common scenarios you may encounter when migrating your Tauri 1.0 app to Tauri 2.0.

The @tauri-apps/api/tauri module was renamed to @tauri-apps/api/core. Simply rename the module import:

The Rust App::get_cli_matches JavaScript @tauri-apps/api/cli APIs have been removed. Use the @tauri-apps/plugin-cli plugin instead:

The Rust App::clipboard_manager and AppHandle::clipboard_manager and JavaScript @tauri-apps/api/clipboard APIs have been removed. Use the @tauri-apps/plugin-clipboard-manager plugin instead:

The Rust tauri::api::dialog JavaScript @tauri-apps/api/dialog APIs have been removed. Use the @tauri-apps/plugin-dialog plugin instead:

The Rust App::get_cli_matches JavaScript @tauri-apps/api/fs APIs have been removed. Use the std::fs for Rust and @tauri-apps/plugin-fs plugin for JavaScript instead:

Some functions and types have been renamed or removed:

Use the Rust std::fs functions.

The Rust App::global_shortcut_manager and AppHandle::global_shortcut_manager and JavaScript @tauri-apps/api/global-shortcut APIs have been removed. Use the @tauri-apps/plugin-global-shortcut plugin instead:

The Rust tauri::api::http JavaScript @tauri-apps/api/http APIs have been removed. Use the @tauri-apps/plugin-http plugin instead:

The HTTP plugin re-exports reqwest so you can check out their documentation for more information.

The Rust tauri::api::notification JavaScript @tauri-apps/api/notification APIs have been removed. Use the @tauri-apps/plugin-notification plugin instead:

The Rust Menu APIs were moved to the tauri::menu module and refactored to use the muda crate.

Use tauri::menu::MenuBuilder instead of tauri::Menu. Note that its constructor takes a Manager instance (one of App, AppHandle or WebviewWindow) as an argument:

Use tauri::menu::PredefinedMenuItem instead of tauri::MenuItem:

The menu builder has dedicated methods to add each predefined menu item so you can call .copy() instead of .item(&PredefinedMenuItem::copy(app, None)?).

Use tauri::menu::MenuItemBuilder instead of tauri::CustomMenuItem:

Use tauri::menu::SubmenuBuilder instead of tauri::Submenu:

tauri::Builder::menu now takes a closure because the menu needs a Manager instance to be built. See the documentation for more information.

The Rust tauri::Builder::on_menu_event API was removed. Use tauri::App::on_menu_event or tauri::AppHandle::on_menu_event instead:

Note that there are two ways to check which menu item was selected: move the item to the event handler closure and compare IDs, or define a custom ID for the item through the with_id constructor and use that ID string to compare.

Menu items can be shared across menus, and the menu event is bound to a menu item instead of a menu or window. If you don’t want all listeners to be triggered when a menu item is selected, do not share menu items and use dedicated instances instead, that you could move into tauri::WebviewWindow/WebviewWindowBuilder::on_menu_event closure.

The Rust tauri::api::os JavaScript @tauri-apps/api/os APIs have been removed. Use the @tauri-apps/plugin-os plugin instead:

The Rust tauri::api::process JavaScript @tauri-apps/api/process APIs have been removed. Use the @tauri-apps/plugin-process plugin instead:

The Rust tauri::api::shell JavaScript @tauri-apps/api/shell APIs have been removed. Use the @tauri-apps/plugin-shell plugin instead:

The Rust SystemTray APIs were renamed to TrayIcon for consistency. The new APIs can be found in the Rust tray module.

Use tauri::tray::TrayIconBuilder instead of tauri::SystemTray:

See TrayIconBuilder for more information.

Use tauri::menu::Menu instead of tauri::SystemTrayMenu, tauri::menu::Submenu instead of tauri::SystemTraySubmenu and tauri::menu::PredefinedMenuItem instead of tauri::SystemTrayMenuItem.

tauri::SystemTray::on_event have been split into tauri::tray::TrayIconBuilder::on_menu_event and tauri::tray::TrayIconBuilder::on_tray_icon_event:

Change of default behavior

The built-in dialog with an automatic update check was removed, use the Rust and JS APIs to check for and install updates instead. Failing to do so will prevent your users from getting further updates!

The Rust tauri::updater and JavaScript @tauri-apps/api-updater APIs have been removed. To set a custom updater target with the @tauri-apps/plugin-updater:

To check for updates:

To set a custom updater target:

The Rust tauri::api::path module functions and tauri::PathResolver have been moved to tauri::Manager::path:

On the Rust side, Window was renamed to WebviewWindow, its builder WindowBuilder is now named WebviewWindowBuilder and WindowUrl is now named WebviewUrl.

Additionally, the Manager::get_window function was renamed to get_webview_window and the window’s parent_window API was renamed to parent_raw to support a high level window parent API.

On the JavaScript side, the WebviewWindow class is now exported in the @tauri-apps/api/webviewWindow path.

The onMenuClicked function was removed, you can intercept menu events when creating a menu in JavaScript instead.

On the JavaScript side, make sure you Migrate to File System Plugin. Additionally, note the changes made to the v1 allowlist in Migrate Permissions.

On the Rust side, make sure you Migrate Path to Tauri Manager.

In Tauri v1, the external binaries and their arguments were defined in the allowlist. In v2, use the new permissions system. Read Migrate Permissions for more information.

On the JavaScript side, make sure you Migrate to Shell Plugin.

On the Rust side, tauri::api::process API has been removed. Use tauri_plugin_shell::ShellExt and tauri_plugin_shell::process::CommandEvent APIs instead. Read the Embedding External Binaries guide to see how.

The “process-command-api” features flag has been removed in v2. So running the external binaries does not require this feature to be defined in the Tauri config anymore.

The v1 allowlist have been rewritten to a completely new system for permissions that works for individual plugins and is much more configurable for multiwindow and remote URL support. This new system works like an access control list (ACL) where you can allow or deny commands, allocate permissions to a specific set of windows and domains, and define access scopes.

To enable permissions for your app, you must create capability files inside the src-tauri/capabilities folder, and Tauri will automatically configure everything else for you.

The migrate CLI command automatically parses your v1 allowlist and generates the associated capability file.

To learn more about permissions and capabilities, see the security documentation.

Last updated: May 13, 2026

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (json):
```json
[lib]name = "app_lib"crate-type = ["staticlib", "cdylib", "rlib"]
```

Example 2 (rust):
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]pub fn run() {    // your code here}
```

Example 3 (rust):
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {  app_lib::run();}
```

Example 4 (elixir):
```elixir
npm install @tauri-apps/cli@latestnpm run tauri migrate
```

---

## Upgrade from Tauri 2.0 Beta | Tauri

**URL:** https://tauri.app/start/migrate/from-tauri-2-beta/

**Contents:**
- Upgrade from Tauri 2.0 Beta
- Automated Migration
- Breaking Changes
  - Tauri Core Plugins
  - Built-In Development Server

This guide walks you through upgrading your Tauri 2.0 beta application to Tauri 2.0 release candidate.

The Tauri v2 CLI includes a migrate command that automates most of the process and helps you finish the migration:

Learn more about the migrate command in the Command Line Interface reference

We have had several breaking changes going from beta to release candidate. These can be either auto-migrated (see above) or manually performed.

We changed how Tauri built-in plugins are addressed in the capabilities PR #10390.

To migrate from the latest beta version you need to prepend all core permission identifiers in your capabilities with core: or switch to the core:default permission and remove old core plugin identifiers.

We also added a new special core:default permission set which will contain all default permissions of all core plugins, so you can simplify the permissions boilerplate in your capabilities config.

We introduced changes to the network exposure of the built-in development server PR #10437 and PR #10456.

The built-in mobile development server no longer exposes network wide and tunnels traffic from the local machine directly to the device.

Currently this improvement does not automatically apply when running on iOS devices (either directly or from Xcode). In this case we default to using the public network address for the development server, but there’s a way around it which involves opening Xcode to automatically start a connection between your macOS machine and your connected iOS device, then running tauri ios dev --force-ip-prompt to select the iOS device’s TUN address (ends with ::2).

Your development server configuration needs to adapt to this change if running on a physical iOS device is intended. Previously we recommended checking if the TAURI_ENV_PLATFORM environment variable matches either android or ios, but since we can now connect to localhost unless using an iOS device, you should instead check the TAURI_DEV_HOST environment variable. Here’s an example of a Vite configuration migration:

The internal-ip NPM package is no longer required, you can directly use the TAURI_DEV_HOST value instead.

Last updated: Oct 6, 2024

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (elixir):
```elixir
npm install @tauri-apps/cli@latestnpm run tauri migrate
```

Example 2 (elixir):
```elixir
yarn upgrade @tauri-apps/cli@latestyarn tauri migrate
```

Example 3 (sql):
```sql
pnpm update @tauri-apps/cli@latestpnpm tauri migrate
```

Example 4 (unknown):
```unknown
cargo install tauri-cli --version "^2.0.0" --lockedcargo tauri migrate
```

---

## Upgrade & Migrate | Tauri

**URL:** https://tauri.app/start/migrate/

**Contents:**
- Upgrade & Migrate

Learn about common scenarios and steps to upgrade from Tauri 1.0 or migrate from another framework.

Last updated: Feb 22, 2025

© 2026 Tauri Contributors. CC-BY / MIT

---

## Vite | Tauri

**URL:** https://tauri.app/start/frontend/vite/

**Contents:**
- Vite
- Checklist
- Example configuration
      - Update Tauri configuration
      - Update Vite configuration:

Vite is a build tool that aims to provide a faster and leaner development experience for modern web projects. This guide is accurate as of Vite 5.4.8.

Assuming you have the following dev and build scripts in your package.json:

You can configure the Tauri CLI to use your Vite development server and dist folder along with the hooks to automatically run the Vite scripts:

Last updated: Jun 24, 2025

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (json):
```json
{  "scripts": {    "dev": "vite",    "build": "tsc && vite build",    "preview": "vite preview",    "tauri": "tauri"  }}
```

Example 2 (json):
```json
{  "build": {    "beforeDevCommand": "npm run dev",    "beforeBuildCommand": "npm run build",    "devUrl": "http://localhost:5173",    "frontendDist": "../dist"  }}
```

Example 3 (json):
```json
{  "build": {    "beforeDevCommand": "yarn dev",    "beforeBuildCommand": "yarn build",    "devUrl": "http://localhost:5173",    "frontendDist": "../dist"  }}
```

Example 4 (json):
```json
{  "build": {    "beforeDevCommand": "pnpm dev",    "beforeBuildCommand": "pnpm build",    "devUrl": "http://localhost:5173",    "frontendDist": "../dist"  }}
```

---

## What is Tauri? | Tauri

**URL:** https://tauri.app/start/

**Contents:**
- What is Tauri?
- Why Tauri?
  - Secure Foundation
  - Smaller App Size
  - Flexible Architecture

Tauri is a framework for building tiny, fast binaries for all major desktop and mobile platforms. Developers can integrate any frontend framework that compiles to HTML, JavaScript, and CSS for building their user experience while leveraging languages such as Rust, Swift, and Kotlin for backend logic when needed.

Get started building with create-tauri-app by using one of the below commands. Be sure to follow the prerequisites guide to install all of the dependencies required by Tauri. For a more detailed walk through, see Create a Project

After you’ve created your first app, take a look at Project Structure to understand what each file does.

Or explore the project setups and features from the examples (tauri | plugins-workspace)

Tauri has 3 main advantages for developers to build upon:

Learn more about the Tauri philosophy in the Tauri 1.0 blog post.

By being built on Rust, Tauri is able to take advantage of the memory, thread, and type-safety offered by Rust. Apps built on Tauri can automatically get those benefits even without needing to be developed by Rust experts.

Tauri also undergoes a security audit for major and minor releases. This not only covers code in the Tauri organization, but also for upstream dependencies that Tauri relies on. Of course this doesn’t mitigate all risks, but it provides a solid foundation for developers to build on top of.

Read the Tauri security policy and the Tauri 2.0 audit report.

Tauri apps take advantage of the web view already available on every user’s system. A Tauri app only contains the code and assets specific for that app and doesn’t need to bundle a browser engine with every app. This means that a minimal Tauri app can be less than 600KB in size.

Learn more about creating optimized apps in the App Size concept.

Since Tauri uses web technologies that means that virtually any frontend framework is compatible with Tauri. The Frontend Configuration guide contains common configurations for popular frontend frameworks.

Bindings between JavaScript and Rust are available to developers using the invoke function in JavaScript and Swift and Kotlin bindings are available for Tauri Plugins.

TAO is responsible for Tauri window creation and WRY is responsible for web view rendering. These are libraries maintained by Tauri and can be consumed directly if deeper system integration is required outside of what Tauri exposes.

In addition, Tauri maintains a number of plugins to extend what core Tauri exposes. You can find those plugins alongside those provided by the community in the Plugins section.

Last updated: Aug 1, 2025

© 2026 Tauri Contributors. CC-BY / MIT

**Examples:**

Example 1 (unknown):
```unknown
sh <(curl https://create.tauri.app/sh)
```

Example 2 (unknown):
```unknown
irm https://create.tauri.app/ps | iex
```

Example 3 (unknown):
```unknown
sh (curl -sSL https://create.tauri.app/sh | psub)
```

Example 4 (elixir):
```elixir
npm create tauri-app@latest
```

---
