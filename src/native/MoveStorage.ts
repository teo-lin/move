import {NativeModules} from 'react-native';

export type SpeechSettings = {
  engine: string | null;
  voice: string | null;
  rate: number;
  engines: {name: string; label: string}[];
  voices: {name: string; locale: string; quality: number}[];
};

type MoveStorageModule = {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<boolean>;
  exportCsv(fileName: string, csv: string): Promise<string>;
  speak(text: string): Promise<boolean>;
  click(): Promise<boolean>;
  repChime(): Promise<boolean>;
  finishChime(): Promise<boolean>;
  restChime(): Promise<boolean>;
  stopAudio(): Promise<boolean>;
  setKeepAwake(enabled: boolean): Promise<boolean>;
  getSpeechSettings(): Promise<SpeechSettings>;
  setSpeechEngine(name: string): Promise<boolean>;
  setSpeechVoice(name: string): Promise<boolean>;
  setSpeechRate(rate: number): Promise<boolean>;
};

export const MoveStorage = NativeModules.MoveStorage as MoveStorageModule;
