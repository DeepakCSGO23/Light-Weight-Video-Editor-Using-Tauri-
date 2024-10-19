use serde_json::{json, Value};
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
    let mut command = Command::new("ffmpeg")
        .args(&[
            "-i",
            input, // Input video file
            "-vn", // Disable video, to extract only the audio
            "-acodec",
            "copy", // Copy the audio codec as-is (no re-encoding)
            output, // Output audio file (e.g., output.mp3 or output.aac)
            "-progress",
            "pipe:1",
            "-nostats",
        ])
        .stderr(Stdio::piped()) // Capture stderr to read progress
        .spawn()
        .map_err(|e| format!("Failed to execute command: {}", e))?;
    if let Some(stderr) = command.stderr.take() {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                // Parse the progress information
                if line.contains("time=") {
                    // Send the progress event to the frontend
                    app.emit("trim-progress", line).unwrap();
                }
            }
        }
    }

    let output = command
        .wait()
        .map_err(|e| format!("Failed to wait for command: {}", e))?;
    if output.success() {
        Ok("Audio extracted successfully".to_string())
    } else {
        println!("fail...");
        Err("Error extracting audio".to_string())
    }
}
// Getting meta data of video file
#[tauri::command]
fn get_video_metadata(file_path: String) -> Result<serde_json::Value, String> {
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
        // Converting raw bytes into a string which is crucial to get the output in a readable string format
        let meta_data = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;
        // Converting string to json (parse the json from the string)
        let v: Value = serde_json::from_str(&meta_data).map_err(|e| e.to_string())?;
        // Extract both video and audio stream information
        let mut video_codec = "Unknown";
        let mut audio_codec = "Unknown";
        let mut video_height = 0;
        let mut video_width = 0;
        let mut video_bitrate = 0;
        let mut audio_bitrate = "Unkown";
        let mut aspec_ratio = "Unknown";
        let mut frame_rate = "Unknown";
        let mut total_audio_channels = 0;
        if let Some(streams) = v["streams"].as_array() {
            for stream in streams {
                if stream["codec_type"] == "video" {
                    video_codec = stream["codec_name"].as_str().unwrap_or("Unknown");
                    video_height = stream["coded_height"].as_i64().unwrap_or(0);
                    video_width = stream["coded_width"].as_i64().unwrap_or(0);
                    video_bitrate = stream["bit_rate"].as_i64().unwrap_or(0);
                    aspec_ratio = stream["display_aspect_ratio"].as_str().unwrap_or("Unknown");
                    frame_rate = stream["avg_frame_rate"].as_str().unwrap_or("Unknown");
                }
                if stream["codec_type"] == "audio" {
                    audio_codec = stream["codec_name"].as_str().unwrap_or("Unknown");
                    audio_bitrate = stream["bit_rate"].as_str().unwrap_or("Unknown");
                    total_audio_channels = stream["channels"].as_i64().unwrap_or(0);
                }
            }
        }
        // Extract total duration from the format section
        let total_duration = v["format"]["duration"].as_str().unwrap_or("Unknown");
        // Create the JSON result
        let result = json!({
            "video_codec": video_codec,
            "audio_codec": audio_codec,
            "total_duration": total_duration,
            "video_height": video_height,
            "video_width": video_width,
            "video_bitrate":video_bitrate,
            "aspect_ratio":aspec_ratio,
            "frame_rate":frame_rate,
            "audio_codec":audio_codec,
            "audio_bitrate":audio_bitrate,
            "total_audio_channels":total_audio_channels
        });
        // Since the return type is a json object we can now return json object from rust backend to the react frontend without any error
        Ok(result)
    } else {
        Err("Failed to get metadata".into())
    }
}
// For closing the application
#[tauri::command]
fn exit_app() {
    std::process::exit(0x0);
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
            get_video_metadata,
            exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
