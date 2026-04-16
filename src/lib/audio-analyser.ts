/**
 * AudioAnalyser — TypeScript port of Sen Voice audio-analyser.js
 * Provides real-time frequency analysis for microphone streams.
 */

// Safari compatibility
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export interface AudioAnalyserResult {
  rms: number;
  bins: [number, number, number, number];
}

export class AudioAnalyser {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private readonly fftSize: number = 512;

  attachStream(mediaStream: MediaStream): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.source) {
      this.source.disconnect();
    }
    this.source = this.ctx.createMediaStreamSource(mediaStream);
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = 0.7;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
    this.source.connect(this.analyser);
  }

  detach(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
  }

  sample(): AudioAnalyserResult {
    if (!this.analyser || !this.dataArray) {
      return { rms: 0, bins: [0, 0, 0, 0] };
    }
    this.analyser.getByteFrequencyData(this.dataArray);

    let sumSq = 0;
    for (const v of this.dataArray) {
      const norm = v / 255;
      sumSq += norm * norm;
    }
    const rms = Math.sqrt(sumSq / this.dataArray.length);

    const bins: [number, number, number, number] = [0, 0, 0, 0];
    const ranges: [number, number][] = [
      [0, 8],
      [8, 32],
      [32, 96],
      [96, Math.min(256, this.dataArray.length)],
    ];
    for (let i = 0; i < 4; i++) {
      const [lo, hi] = ranges[i];
      let sum = 0;
      for (let j = lo; j < hi; j++) sum += this.dataArray[j];
      bins[i] = sum / (hi - lo) / 255;
    }

    return { rms, bins };
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  dispose(): void {
    this.detach();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.analyser = null;
    this.dataArray = null;
  }
}
