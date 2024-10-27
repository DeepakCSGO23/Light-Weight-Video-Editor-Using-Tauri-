import React, { useEffect, useRef, useState } from "react";

export default function WebcamModal({ isOpen }) {
  const webcamModalRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const recorderRef = useRef(null);
  const [isWebcamModalOpen, setIsWebcamModalOpen] = useState(true);
  const streamRef = useRef(null);
  // Whenever the i change the filter option outside the child component
  useEffect(() => {
    if (isOpen === "record") {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((stream) => {
          webcamModalRef.current.srcObject = stream;
          // We use this stream state in the cleanup function to stop webcam access
          streamRef.current = stream;
          const recorder = new MediaRecorder(stream, {
            mimeType: "video/webm",
          });
          console.log("new recorder : ", recorder.stream);
          recorderRef.current = recorder;
        })
        .catch((error) => console.error("Error accessing webcam:", error));
    }
    return () => {
      if (streamRef.current) {
        // Stop the tracks from stream
        streamRef.current.getTracks().forEach((track) => track.stop());
        // Release the recorder
        recorderRef.current = null;
      }
    };
  }, [isOpen]);
  const handleRecordingVideo = () => {
    recorderRef.current.ondataavailable = (e) => {
      // There is some video chunks available
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, {
        mimeType: "video/webm; codecs=vp9",
      });
      const url = URL.createObjectURL(blob);
      console.log(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = "webcam-recording.webm";
      a.click();
      // Cleanup URL and reset chunks
      URL.revokeObjectURL(url);
      // Resetting the video chunks
      recordedChunksRef.current = [];
    };
    recorderRef.current.start();
  };
  // Handling saving recorded webcam video
  const handleDownloadingRecordedVideo = () => {
    console.log("recording ended");
    recorderRef.current.stop();
  };
  return (
    isOpen === "record" && (
      <div className="absolute top-1/4 left-1/4 h-1/2 w-1/2 z-20 border-2 border-gray-400 bg-neutral-800 rounded-3xl">
        <video className="h-full w-full" autoPlay ref={webcamModalRef}></video>
        {/* Webcam & Screen Recorder controller */}
        <div className="flex h-14 items-center justify-center bg-slate-400 space-x-6">
          <img
            onClick={handleRecordingVideo}
            src="../src-tauri/icons/record.svg"
            alt="Pause"
            height="25"
            width="25"
          />
          <button
            onClick={handleRecordingVideo}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Start
          </button>
          <button
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={handleDownloadingRecordedVideo}
          >
            Stop
          </button>
          <button onClick={() => setIsWebcamModalOpen((prev) => !prev)}>
            Close
          </button>
        </div>
      </div>
    )
  );
}
