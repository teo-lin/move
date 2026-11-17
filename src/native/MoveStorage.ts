import {NativeModules} from 'react-native';

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
};

export const MoveStorage = NativeModules.MoveStorage as MoveStorageModule;
