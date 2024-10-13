use std::io::{BufRead, BufReader};
use std::process::Stdio;
use std::process::{Command, Output};
use tauri::{AppHandle, Emitter};
// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
// Trimming video
#[tauri::command]
fn trim_video(input: &str, output: &str, start: f64, duration: f64) -> Result<String, String> {
    // Execute the command
    let output: Output = Command::new("ffmpeg")
        .args(&[
            "-i",
            input,
            "-ss",
            &start.to_string(),
            "-t",
            &duration.to_string(),
            "-c",
            "copy",
            output,
        ])
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?; // Use map_err for proper error handling

    // Check if the command was successful
    if output.status.success() {
        // Convert the stdout bytes to a String
        let success_message = String::from_utf8_lossy(&output.stdout);
        Ok(format!(
            "Video trimmed successfully: {}",
            success_message.trim()
        ))
    } else {
        // Convert the stderr bytes to a String
        let error_message = String::from_utf8_lossy(&output.stderr);
        Err(format!("Error trimming video: {}", error_message.trim()))
    }
}
// Extracting audio from video with progress event being send to the frontend
#[tauri::command]
fn extract_audio(input: &str, output: &str, app: AppHandle) -> Result<String, String> {
    println!("extracting...");

    let mut command = Command::new("ffmpeg")
        .args(&[
            "-i", input, // Input video file
            "-vn", // Disable video, to extract only the audio
            "-acodec", "copy", // Copy the audio codec as-is (no re-encoding)
            output, // Output audio file (e.g., output.mp3 or output.aac)
        ])
        .stderr(Stdio::piped()) // Capture stderr to read progress
        .spawn()
        .map_err(|e| format!("Failed to execute command: {}", e))?;
    println!("completed extracting...");
    if let Some(stderr) = command.stderr.take() {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                // Parse the progress information
                if line.contains("time=") {
                    println!("time is : {}", line);
                    // Send the progress event to the frontend
                    app.emit("trim-progress", line).unwrap();
                }
            }
        }
    }

    let output = command
        .wait()
        .map_err(|e| format!("Failed to wait for command: {}", e))?;
    println!("here");
    if output.success() {
        println!("success...");
        Ok("Audio extracted successfully".to_string())
    } else {
        println!("fail...");
        Err("Error extracting audio".to_string())
    }
}
// Getting meta data of video file
#[tauri::command]
fn get_video_metadata(file_path: String) -> Result<String, String> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            &file_path,
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let metadata = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;
        Ok(metadata)
    } else {
        Err("Failed to get metadata".into())
    }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            trim_video,
            extract_audio,
            get_video_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
