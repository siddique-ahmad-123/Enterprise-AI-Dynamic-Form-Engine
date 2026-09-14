import React from "react";
import { ChatInputBar } from "./ChatInputBar";

interface VoiceInputControlProps {
  onAppendText?: (text: string) => void;
  isSubmitted?: boolean;
}

export const VoiceInputControl: React.FC<VoiceInputControlProps> = (props) => {
  return <ChatInputBar {...props} />;
};
