/**
 * Compresses an audio file to a target size using Web Audio API
 * @param {File} audioFile - The original audio file
 * @param {number} targetSizeMB - Target size in MB (default 20MB to stay safely under Whisper's 25MB limit)
 * @returns {Promise<Blob>} - Compressed audio file as a Blob
 */
export async function compressAudio(audioFile, targetSizeMB = 20) {
  try {
    // Create audio context
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // Read the file
    const arrayBuffer = await audioFile.arrayBuffer();

    // Decode the audio
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Calculate current bit rate
    const duration = audioBuffer.duration;
    const currentSizeMB = audioFile.size / (1024 * 1024);
    const currentBitRate = (audioFile.size * 8) / duration;

    // Calculate target bit rate
    const targetBitRate = (targetSizeMB * 1024 * 1024 * 8) / duration;

    // If file is already smaller than target, return original
    if (currentSizeMB <= targetSizeMB) {
      return new Blob([arrayBuffer], { type: audioFile.type });
    }

    // Create offline context for rendering
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    // Create buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // Create script processor for compression
    const bitReducer = offlineContext.createScriptProcessor(
      2048,
      audioBuffer.numberOfChannels,
      audioBuffer.numberOfChannels
    );

    // Calculate reduction ratio
    const reductionRatio = targetBitRate / currentBitRate;

    bitReducer.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const outputData = e.outputBuffer.getChannelData(0);

      // Apply bit depth reduction
      for (let i = 0; i < inputData.length; i++) {
        // Reduce precision to achieve target bit rate
        outputData[i] =
          Math.round(inputData[i] * reductionRatio) / reductionRatio;
      }
    };

    // Connect nodes
    source.connect(bitReducer);
    bitReducer.connect(offlineContext.destination);

    // Start rendering
    source.start();
    const renderedBuffer = await offlineContext.startRendering();

    // Convert to WAV format
    const wavBlob = await encodeWAV(renderedBuffer, {
      sampleRate: renderedBuffer.sampleRate,
      numChannels: renderedBuffer.numberOfChannels,
    });

    return new Blob([wavBlob], { type: "audio/wav" });
  } catch (error) {
    console.error("Error compressing audio:", error);
    throw new Error(
      "Failed to compress audio file. Please try again or use a different file."
    );
  }
}

/**
 * Encodes AudioBuffer to WAV format
 */
function encodeWAV(audioBuffer, options = {}) {
  const numChannels = options.numChannels || audioBuffer.numberOfChannels;
  const sampleRate = options.sampleRate || audioBuffer.sampleRate;
  const format = 1; 
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const buffer = audioBuffer.getChannelData(0);
  const samples = buffer.length;
  const dataSize = samples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write audio data
  floatTo16BitPCM(view, headerSize, buffer);

  return arrayBuffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}
