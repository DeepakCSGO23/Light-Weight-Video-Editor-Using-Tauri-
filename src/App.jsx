// Before i was installing modules which are not available
import { useEffect, useRef, useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open, confirm } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";

import "./App.css";
function App() {
  const videoRef = useRef(null);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [videoFileName, setVideoFileName] = useState("");
  const [videoSrc, setVideoSrc] = useState("");
  const [videoMetaData, setVideoMetaData] = useState({});
  const [totalVideoDuration, setTotalVideoDuration] = useState(0);
  const [currentVideoDuration, setCurrentVideoDuration] = useState(0);
  const [startingDuration, setStartingDuration] = useState(0);
  const [endingDuration, setEndingDuration] = useState(0);
  const [isVideoTrimmedSuccessfully, setIsVideoTrimmedSuccessfully] =
    useState(false);
  const [selectedEditOption, setSelectedEditOption] = useState("trim");
  const [selectedFilter, setSelectedFilter] = useState("");
  // Side effect is called whenever the user selects new video
  // Reference to the video element
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      // When the the video element is inserted in the dom we set the default volume to 0.2 i.e 20% initially
      videoElement.volume = 0.2;
      // After the video's meta data is loaded we set the total duration state
      const handleLoadedMetaData = () => {
        setTotalVideoDuration(videoElement.duration);
      };
      const handleCurrentVideoDurationChange = () => {
        // Updates the current video duration state which is used for
        setCurrentVideoDuration(videoElement.currentTime);
      };
      // Adding event listeners to get video total duration metadata after the video's metadata is loaded
      videoElement.addEventListener("loadedmetadata", handleLoadedMetaData);
      // The event listener listens for any change in the video i.e video duration change
      videoElement.addEventListener(
        "timeupdate",
        handleCurrentVideoDurationChange
      );
      // Remove the event listeners when the component unmounts
      return () => {
        videoElement.removeEventListener(
          "loadedmetadata",
          handleLoadedMetaData
        );
        videoElement.removeEventListener(
          "timeupdate",
          handleCurrentVideoDurationChange
        );
      };
    } else {
      console.log("no video selected");
    }
  }, [videoSrc]);
  // Handle spacebar to play/pause the video
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space") {
        const videoElement = videoRef.current;
        if (videoElement.paused) {
          videoElement.play();
        } else {
          videoElement.pause();
        }
      } else if (e.ctrlKey && e.key === "t") {
        setSelectedEditOption("trim");
      } else if (e.ctrlKey && e.key === "c") {
        setSelectedEditOption("crop");
      } else if (e.ctrlKey && e.key === "a") {
        setSelectedEditOption("extract-audio");
      }
    };
    // Add event listener for keydown
    window.addEventListener("keydown", handleKeyDown);
    // Cleanup event listeners on component unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleOpeningFile = async () => {
    try {
      // Open file dialog to select a video file
      const selectedFilePath = await open({
        multiple: false,
        filters: [
          {
            name: "Video Files",
            extensions: ["mp4", "webm", "ogg"], // Specify video file types
          },
        ],
      });
      if (selectedFilePath) {
        const fileUrl = convertFileSrc(selectedFilePath);
        // Getting the meta data of the video file
        const videoMetaData = await invoke("get_video_metadata", {
          // The camelCase in javascript is converted into snake_case before passing them to the Rust function so filePath becomes file_path
          filePath: selectedFilePath,
        });
        const videoMetaDataInJson = JSON.parse(videoMetaData);
        console.log(videoMetaDataInJson);
        // Setting the video's meta data
        setVideoMetaData(videoMetaDataInJson.streams[0]);
        // Closing File menu pop-up
        setShowFileMenu(false);
        // Set the selected file path as the video source
        setVideoSrc(fileUrl);
        // Update the file name state of the newly selected file
        setVideoFileName(selectedFilePath.split("\\").pop());
      } else {
        console.log("No file selected");
      }
    } catch (err) {
      console.error("Failed to open file", err);
    }
  };
  //? When the dot is moved
  const handleMoveVideoDuration = (e) => {
    // Current Video duration
    const currentVideoDuration = e.target.value;
    // Target the video ref (video dom) and change its current time property to the new video duration setup by the range slider
    videoRef.current.currentTime = currentVideoDuration;
    // Update the current video duration state
    setCurrentVideoDuration(currentVideoDuration);
  };
  // When the left trim controller is moved
  const handleStartingDurationChange = (e) => {
    console.log(e.target.value);
    //* Parsing string to float because string "9.0" is greater than "11.5" because the ascii value of '9' is greater than '1' so without remaining string it declares string "9.0" is greater than "11.5"
    const newStartingDuration = e.target.value;
    if (newStartingDuration < endingDuration) {
      setStartingDuration(newStartingDuration);
      // The video duration is changing which calls the setCurrentVideoDuration function which updates the current video duration state
      if (videoRef.current) {
        videoRef.current.currentTime = newStartingDuration;
      }
    }
  };
  // When the right trim controller is moved
  const handleEndingDurationChange = (e) => {
    // Parsing string to float because string "9.0" is greater than "11.5" because the ascii value of '9' is greater than '1' so without remaining string it declares string "9.0" is greater than "11.5"
    const newEndingDuration = e.target.value;
    if (newEndingDuration > startingDuration) {
      setEndingDuration(newEndingDuration);
      if (videoRef.current) {
        //* Look here since the video's current duration is changed the ontimechange event is fired which calls the setCurrentVideoDuration setter function and updates the currentVideoDuration state
        videoRef.current.currentTime = newEndingDuration;
      }
    }
  };
  // When the user clicks the start video i.e start playing video from pause state
  const handlePlayingVideo = () => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.play();
    }
  };
  // When the user clicks the pause button i.e pausing video from playing state
  const handlePausingVideo = () => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.pause();
    }
  };
  // For changing volume of video
  const handleVideoVolumeChange = (e) => {
    // First check if the video element is present in the DOM
    const videoElement = videoRef.current;
    // We found a video element present in the DOM
    if (videoElement) {
      const currentVolume = e.target.value / 100;
      console.log(currentVolume);
      videoElement.volume = currentVolume;
    }
  };
  // When the user clicks the trim video button
  async function handleTrimmingVideo() {
    // Show confirmation dialog before trimming
    const askConfirmation = await confirm("Do you want to trim the video?", {
      title: "Confirmation",
      type: "warning",
    });
    // Confirmation is success
    if (askConfirmation) {
      try {
        const result = await invoke("trim_video", {
          input: "E:/SkillRack Guide/Desktop/Sample.mp4",
          output: "E:/SkillRack Guide/Desktop/OutputSample.mp4",
          start: 5.0,
          duration: 10.0,
        });
        setIsVideoTrimmedSuccessfully(true);
        setTimeout(() => {
          setIsVideoTrimmedSuccessfully(false);
        }, 4000);
      } catch (error) {
        console.error("Error trimming video:", error);
      }
    }
    // The user cancels the trimming process
    else {
      console.log("User cancelled the trimming process");
    }
  }
  // When the user clicks the extract audio button
  async function handleExtractingAudioFromVideo() {
    // Show confirmation dialog before trimming
    const askConfirmation = await confirm(
      "Do you want to extract audio from the video?",
      {
        title: "Confirmation",
        type: "warning",
      }
    );
    // Confirmation is success
    if (askConfirmation) {
      // Now the extracting audio process is started in the backend so now we are going to listen to progress events from the backend
      const unlisten = await listen("trim-progress", (e) => {
        console.log(e.payload);
        setProgress(e.payload); // Update progress in state
      });
      try {
        const result = await invoke("extract_audio", {
          input: "E:/SkillRack Guide/Desktop/Sample.mp4",
          output: "E:/SkillRack Guide/Desktop/AudioSample.aac",
        });
        setIsVideoTrimmedSuccessfully(true);
        setTimeout(() => {
          setIsVideoTrimmedSuccessfully(false);
        }, 4000);
      } catch (error) {
        console.error("Error extracting audio from video:", error);
      } finally {
        // Unlisten when extraction is done
        unlisten();
      }
    }
    // The user cancels the trimming process
    else {
      console.log("User cancelled the trimming process");
    }
  }
  // Formating duration in 00:00:00 format
  const formatFloatDurationToIntegerVideoDuration = (seconds) => {
    // Converting float to integer because we don't want something like this 00:02:5.7000 we only want like this 00:02:05
    let newSeconds = parseInt(seconds);
    const hours = Math.floor(newSeconds / 3600);
    const minutes = Math.floor((newSeconds % 3600) / 60);
    const secs = newSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  return (
    <div className="bg-[#121212] h-screen w-screen text-white text-sm font-roboto flex flex-col justify-start items-center">
      <header className="p-2 bg-white text-black flex justify-between items-center w-screen">
        <div className="relative w-full">
          <button onClick={() => setShowFileMenu(!showFileMenu)}>File</button>
          {showFileMenu && (
            <div className="absolute z-10 p-2 bg-gray-200 w-[8%] flex flex-col rounded shadow-lg">
              <button
                className="p-2 hover:text-gray-400"
                onClick={handleOpeningFile}
              >
                Open Video
              </button>
              <button className="p-2 hover:text-gray-400">Save As</button>
              <button className="p-2 hover:text-gray-400">
                Export Setting
              </button>
            </div>
          )}
        </div>
      </header>
      {/* Confirmation message after successfuly trimming the video */}
      {isVideoTrimmedSuccessfully && (
        <div className="absolute left-1/4 top-1/4 h-80 w-80 z-20 bg-green-400 text-white p-4 flex flex-col items-center justify-center rounded-3xl">
          <h1>Hooray! Your video is trimmed and looking fabulous!</h1>
          <span>E:/SkillRack Guide/Desktop/OutputSample.mp4</span>
        </div>
      )}
      {/* Video Player and Playback controls */}
      <main className="w-[100%] h-[60%] flex p-16 space-x-40">
        {/* Video file meta data */}
        <div className="flex flex-col space-y-10 w-1/5">
          {/* Note */}
          {/* <em className="text-xs mb-16">
            To modify your preferences, please navigate to the export settings
          </em> */}
          <h1 className="tracking-widest font-bold text-base text-green-400 mb-10">
            META-DATA
          </h1>
          <div className="flex flex-col space-y-4">
            <h2 className="overflow-hidden whitespace-nowrap truncate w-72">
              File Name : {videoFileName}
            </h2>
            <h2>Height : {videoMetaData.height}</h2>
            <h2>Width : {videoMetaData.width}</h2>
            <h2>Avg Frame Rate : {videoMetaData.avg_frame_rate}</h2>
            <h2>Codec Type : {videoMetaData.codec_type}</h2>
            <h2>Codec Name : {videoMetaData.codec_name}</h2>
          </div>
        </div>
        {videoSrc && (
          <div className="relative flex flex-col w-[50%] h-[75%]">
            {/* <h1 className="text-green-400 tracking-widest text-base font-bold">
              VIDEO
            </h1> */}
            <video
              className={`h-full w-full shadow-2xl bg-neutral-800 border-x-2 border-t-2 border-dashed rounded-t-xl ${
                selectedEditOption === "crop" && "cursor-crosshair"
              } ${
                selectedFilter === "brightness"
                  ? "brightness-150"
                  : selectedFilter === "hue"
                  ? "hue-rotate-90"
                  : selectedFilter === "saturation"
                  ? "saturate-150"
                  : selectedFilter === "grayscale"
                  ? "grayscale"
                  : selectedFilter === "sepia"
                  ? "sepia"
                  : ""
              } `}
              ref={videoRef}
              src={videoSrc}
            ></video>
            {/* Playback controls */}
            <div className="relative flex flex-col rounded-b-3xl bg-zinc-800">
              <input
                onChange={handleMoveVideoDuration}
                type="range"
                min="0"
                max={totalVideoDuration}
                value={currentVideoDuration}
                step="0.1"
                className="play-back w-full"
              />
              <div className="flex items-center space-x-40 p-4 pb-6 ml-10">
                {currentVideoDuration && totalVideoDuration && (
                  <span className="w-fit">
                    {formatFloatDurationToIntegerVideoDuration(
                      currentVideoDuration
                    )}{" "}
                    /{" "}
                    {formatFloatDurationToIntegerVideoDuration(
                      totalVideoDuration
                    )}
                  </span>
                )}
                <div className="flex items-center space-x-6">
                  <img
                    onClick={handlePausingVideo}
                    className="cursor-pointer"
                    height="25"
                    width="25"
                    src="../src-tauri/icons/pause.svg"
                    alt="pause-video"
                    title="Pause Video"
                  />
                  <img
                    onClick={handlePlayingVideo}
                    className="cursor-pointer"
                    height="20"
                    width="20"
                    src="../src-tauri/icons/play.svg"
                    alt="start-video"
                    title="Start Video"
                  />
                </div>
                {/* Volume Customization */}
                <div className="flex space-x-2">
                  <img
                    onClick={handlePausingVideo}
                    className="cursor-pointer"
                    height="25"
                    width="25"
                    src="../src-tauri/icons/audio.svg"
                    alt="Volume"
                    title="Volume"
                  />
                  <input
                    onChange={handleVideoVolumeChange}
                    type="range"
                    defaultValue="10"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Check filters layout first */}
        {/* Filters */}
        <div className="w-[20%] flex flex-col items-start space-y-10">
          <h1 className="text-green-400 tracking-widest font-bold text-base mb-10">
            FILTERS
          </h1>
          {/* Choose different filters by scrolling */}
          <div className="grid grid-rows-2 grid-cols-3 gap-6">
            <div className="flex flex-col items-center space-y-2">
              <div
                className={`${
                  selectedFilter === "brightness" && "border-2 border-blue-600"
                } rounded-xl`}
              >
                <img
                  onClick={() => setSelectedFilter("brightness")}
                  className="cursor-pointer rounded-xl h-16 w-16 brightness-150"
                  src="../src-tauri/icons/sample.png"
                  alt="Sample Image"
                />
              </div>
              <h2>Brightness</h2>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div
                className={`${
                  selectedFilter === "hue" && "border-2 border-blue-600"
                } rounded-xl`}
              >
                <img
                  onClick={() => setSelectedFilter("hue")}
                  className="cursor-pointer rounded-xl h-16 w-16 hue-rotate-60"
                  src="../src-tauri/icons/sample.png"
                  alt="Sample Image"
                />
              </div>
              <h2>Hue</h2>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div
                className={`${
                  selectedFilter === "saturation" && "border-2 border-blue-600"
                } rounded-xl`}
              >
                <img
                  onClick={() => setSelectedFilter("saturation")}
                  className="cursor-pointer rounded-xl h-16 w-16 saturate-200"
                  src="../src-tauri/icons/sample.png"
                  alt="Sample Image"
                />
              </div>
              <h2>Saturation</h2>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div
                className={`${
                  selectedFilter === "grayscale" && "border-2 border-blue-600"
                } rounded-xl`}
              >
                <img
                  onClick={() => setSelectedFilter("grayscale")}
                  className="cursor-pointer rounded-xl h-16 w-16 grayscale"
                  src="../src-tauri/icons/sample.png"
                  alt="Sample Image"
                />
              </div>
              <h2>Grayscale</h2>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div
                className={`${
                  selectedFilter === "sepia" && "border-2 border-blue-600"
                } rounded-xl`}
              >
                <img
                  onClick={() => setSelectedFilter("sepia")}
                  className="cursor-pointer rounded-xl h-16 w-16 sepia"
                  src="../src-tauri/icons/sample.png"
                  alt="Sample Image"
                />
              </div>
              <h2>Sepia</h2>
            </div>
          </div>
          {/* Intensity range slider */}
          <div className="flex flex-col space-y-4 w-full">
            <h1>Intensity</h1>
            <input type="range" className="" />
          </div>
        </div>
      </main>
      {/* Video Timeline */}
      <div className="w-full h-full p-16 flex flex-col space-y-10 bg-gradient-to-r from-[#161616] to-[#212122]">
        <div className="flex items-start space-x-40">
          <h1 className="font-bold text-base tracking-widest text-green-400">
            EDITOR
          </h1>
          <div className="flex space-x-10">
            <div
              onClick={() => setSelectedEditOption("trim")}
              className={`cursor-pointer w-6 h-6 transition-all duration-200 flex justify-center items-center rounded-full ${
                selectedEditOption === "trim" && "bg-blue-700 p-1.5"
              }`}
            >
              <img
                className="w-12 h-12 rounded-full"
                src="../src-tauri/icons/trim.svg"
                alt="Trim Video"
                title="Trim (Ctr+T)"
              />
            </div>
            <div
              onClick={() => setSelectedEditOption("crop")}
              className={`cursor-pointer w-6 h-6 transition-all duration-200 flex justify-center items-center rounded-full ${
                selectedEditOption === "crop" && "bg-blue-700 p-1.5"
              }`}
            >
              <img
                className="w-full h-full rounded-full"
                src="../src-tauri/icons/crop.svg"
                alt="Crop Video"
                title="Crop (Ctr+C)"
              />
            </div>
            <div
              onClick={() => setSelectedEditOption("extract-audio")}
              className={`cursor-pointer w-6 h-6 transition-all duration-200 flex justify-center items-center rounded-full ${
                selectedEditOption === "extract-audio" && "bg-blue-700 p-1.5"
              }`}
            >
              <img
                className="w-full h-full rounded-full"
                src="../src-tauri/icons/extract-audio.svg"
                alt="Extract Audio"
                title="Extract Audio (Ctr+A)"
              />
            </div>
          </div>
          {/* Trim Video Controls */}
          {selectedEditOption === "trim" && (
            <div className="flex items-start space-x-10">
              <h1>
                Start Duration :{" "}
                {formatFloatDurationToIntegerVideoDuration(startingDuration)}
              </h1>
              <h1>
                Ending Duration :{" "}
                {formatFloatDurationToIntegerVideoDuration(endingDuration)}
              </h1>
              <button className="relative bottom-4 bg-white text-black p-4 pl-6 pr-6 rounded-full">
                Trim Video
              </button>
            </div>
          )}
          {/* Crop Video Controls */}
          {selectedEditOption === "crop" && (
            <div className="flex items-center space-x-10">
              <button className="relative bottom-4 bg-white text-black p-4 pl-6 pr-6 rounded-full">
                Crop Video
              </button>
            </div>
          )}
          {/* Extract Audio Controls */}
          {selectedEditOption === "extract-audio" && (
            <div className="flex items-center space-x-10">
              <button
                onClick={handleExtractingAudioFromVideo}
                className="relative bottom-4 bg-white text-black p-4 pl-6 pr-6 rounded-full"
              >
                Extract Audio
              </button>
            </div>
          )}
        </div>
        {/* Video & Audio Layer */}
        <div className="h-full flex items-center space-x-10">
          {videoFileName && (
            <h1 className="max-w-20 h-10 overflow-hidden text-ellipsis">
              {videoFileName}
            </h1>
          )}
          {/* The Timeline 🥱 */}
          <div className="relative flex h-32 w-full overflow-x-auto border-2 border-gray-600 rounded-xl pl-8 pr-8 pt-2">
            {/* Wrapper - This saved my life */}
            <div className="flex absolute whitespace-nowrap min-w-full">
              {totalVideoDuration &&
                Array.from({ length: Math.ceil(totalVideoDuration / 10) }).map(
                  // Create Ruler-like ui
                  (_, index) => (
                    <div key={index} className="flex flex-col">
                      <h1 className={`relative right-6`}>
                        {formatFloatDurationToIntegerVideoDuration(index * 10)}
                      </h1>
                      <div className="flex space-x-3 mr-3">
                        {/* Ruler markers */}
                        <div className="h-6 w-0.5 bg-gray-400"></div>
                        <div className="h-2 w-0.5 bg-gray-400"></div>
                        <div className="h-2 w-0.5 bg-gray-400"></div>
                        <div className="h-2 w-0.5 bg-gray-400"></div>
                        <div className="h-2 w-0.5 bg-gray-400"></div>
                        <div className="h-6 w-0.5 bg-gray-400"></div>
                        <div className="h-2 w-0.5 bg-gray-400"></div>
                        <div className="h-2 w-0.5 bg-gray-400"></div>
                        <div className="h-2 w-0.5 bg-gray-400"></div>
                        <div className="h-2 w-0.5 bg-gray-400"></div>
                      </div>
                    </div>
                  )
                )}
              {/* Left trim slider */}
              {selectedEditOption === "trim" && (
                <input
                  // We are updating the startingDuration state whenever the left trim slider is changed and we are controlling i.e we are setting the current slider to the position/value pointed by the startingDuration state
                  onChange={handleStartingDurationChange}
                  type="range"
                  className="min absolute z-10 appearance-none cursor-pointer outline-none bg-transparent w-full"
                  min="0"
                  max={totalVideoDuration}
                  value={startingDuration}
                  step="0.1"
                />
              )}
              {/* Video player red slider */}
              <input
                onChange={handleMoveVideoDuration}
                type="range"
                className="red-slider absolute z-10 appearance-none cursor-pointer outline-none bg-transparent w-full"
                min="0"
                max={totalVideoDuration}
                value={currentVideoDuration}
                step="0.1"
              />
              {/* Right trim slider */}
              {selectedEditOption === "trim" && (
                <input
                  onChange={handleEndingDurationChange}
                  type="range"
                  className="max absolute z-10 appearance-none cursor-pointer outline-none bg-transparent w-full"
                  min="0"
                  max={totalVideoDuration}
                  value={endingDuration}
                  step="0.1"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default App;
