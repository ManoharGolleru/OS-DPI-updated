import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { TreeBase } from "./treebase";
import { html } from "uhtml";
import Globals from "app/globals";
import * as Props from "./props";

class Speech extends TreeBase {
  stateName = new Props.String("$Speak");
  voiceURI = new Props.String("$VoiceURI", "en-US-DavisNeural"); // Default to Davis
  expressStyle = new Props.String("$ExpressStyle", "friendly"); // Default expression style
  isSpeaking = false; // Track if currently speaking

  constructor() {
    super();
    this.initSynthesizer();
  }

  logWithTimestamp(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  initSynthesizer() {
    this.speechConfig = sdk.SpeechConfig.fromSubscription('c7d8e36fdf414cbaae05819919fd416d', 'eastus');
    this.speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3; // Using MP3 format with appropriate bitrate
    this.audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
    this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, this.audioConfig);

    // Adding logging for debug purposes
    this.synthesizer.synthesisStarted = (s, e) => this.logWithTimestamp("Synthesis started");
    this.synthesizer.synthesisCompleted = (s, e) => {
      this.logWithTimestamp("Synthesis completed");
      this.isSpeaking = false; // Reset speaking flag
      this.initSynthesizer(); // Re-initialize the synthesizer after each synthesis
    };
    this.synthesizer.synthesisCanceled = (s, e) => {
      this.logWithTimestamp(`Synthesis canceled: ${e.reason}`);
      this.isSpeaking = false; // Reset speaking flag
      this.initSynthesizer(); // Re-initialize the synthesizer after each synthesis
    };
  }

  async speak() {
    if (this.isSpeaking) {
      this.logWithTimestamp("Cancelling current speech synthesis.");
      this.synthesizer.close();
      this.isSpeaking = false;
    }

    this.isSpeaking = true;

    const { state } = Globals;
    const message = state.get("$Speak");
    const voice = state.get("$VoiceURI") || "en-US-DavisNeural"; // Default to "en-US-DavisNeural"
    const style = state.get("$ExpressStyle") || "friendly";

    if (!message) {
      this.logWithTimestamp("No message to speak.");
      this.isSpeaking = false; // Reset speaking flag
      return;
    }

    this.logWithTimestamp(`Using voice: ${voice}, style: ${style}, message: ${message}`);

    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
        <voice name="${voice}">
          <mstts:express-as style="${style}">
            ${message}
          </mstts:express-as>
        </voice>
      </speak>`;

    try {
      this.synthesizer.speakSsmlAsync(
        ssml,
        result => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            this.logWithTimestamp("Speech synthesized successfully");
          } else if (result.reason === sdk.ResultReason.Canceled) {
            const cancellationDetails = sdk.SpeechSynthesisCancellationDetails.fromResult(result);
            this.logWithTimestamp(`Speech synthesis canceled: ${cancellationDetails.reason}, ${cancellationDetails.errorDetails}`);
          }
          this.isSpeaking = false; // Reset speaking flag
          this.initSynthesizer(); // Re-initialize the synthesizer after each synthesis
        },
        error => {
          this.logWithTimestamp(`An error occurred: ${error}`);
          this.isSpeaking = false; // Reset speaking flag
          this.initSynthesizer(); // Re-initialize the synthesizer after each synthesis
        }
      );
    } catch (error) {
      this.logWithTimestamp(`Error in speak method: ${error}`);
      this.isSpeaking = false; // Reset speaking flag
      this.initSynthesizer(); // Re-initialize the synthesizer after each synthesis
    }
  }

  disconnectedCallback() {
    if (this.isSpeaking) {
      this.synthesizer.close();
      this.isSpeaking = false;
      this.logWithTimestamp("Synthesizer stopped on component disconnect");
    }
  }

  template() {
    const { stateName } = this.props; // Only check for stateName
    const { state } = Globals;
    if (state.hasBeenUpdated(stateName)) {
      this.speak();
    }
    return this.empty;
  }
}

// Register the Speech class with the component framework
TreeBase.register(Speech, "Speech");



