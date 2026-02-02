// src/components/AudioRecorder.jsx
// Component for recording audio messages

import { useState, useRef } from 'react';
import PropTypes from 'prop-types';

const AudioRecorder = ({ onRecordingComplete, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const isCancelledRef = useRef(false);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      isCancelledRef.current = false;

      // Collect audio data
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());

        // Only call onRecordingComplete if not cancelled
        if (!isCancelledRef.current && onRecordingComplete && chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          onRecordingComplete(blob);
        }
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Failed to access microphone. Please grant permission and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Set cancelled flag BEFORE stopping
      isCancelledRef.current = true;

      // Stop recording
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop microphone stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Clear chunks
      chunksRef.current = [];

      // Call parent cancel callback
      if (onCancel) {
        onCancel();
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 bg-[#1C1C1E] rounded-lg px-4 py-3">
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 text-[#A076F9] hover:opacity-80 transition-opacity"
        >
          <span className="material-symbols-outlined text-2xl">mic</span>
          <span className="text-sm">Start Recording</span>
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-1">
            <span className="material-symbols-outlined text-2xl text-red-500 animate-pulse">
              fiber_manual_record
            </span>
            <span className="text-white text-sm font-mono">{formatTime(recordingTime)}</span>
          </div>

          <button
            onClick={cancelRecording}
            className="flex items-center justify-center p-2 hover:bg-[#2C2C2E] rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-xl text-gray-400">close</span>
          </button>

          <button
            onClick={stopRecording}
            className="flex items-center justify-center p-2 hover:bg-[#2C2C2E] rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-xl text-[#A076F9]">send</span>
          </button>
        </>
      )}
    </div>
  );
};

AudioRecorder.propTypes = {
  onRecordingComplete: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};

export default AudioRecorder;
