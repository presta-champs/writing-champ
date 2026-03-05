import { ANN_HANDLEY } from "./ann-handley";
import { CARL_SAGAN } from "./carl-sagan";
import { DAVID_SEDARIS } from "./david-sedaris";
import { KATIE_NOTOPOULOS } from "./katie-notopoulos";
import { MALCOLM_GLADWELL } from "./malcolm-gladwell";
import { MICHAEL_LEWIS } from "./michael-lewis";
import { PAUL_GRAHAM } from "./paul-graham";
import { SETH_GODIN } from "./seth-godin";

export const BUILTIN_PERSONAS = [
  ANN_HANDLEY,
  CARL_SAGAN,
  DAVID_SEDARIS,
  KATIE_NOTOPOULOS,
  MALCOLM_GLADWELL,
  MICHAEL_LEWIS,
  PAUL_GRAHAM,
  SETH_GODIN,
] as const;

export type BuiltinPersona = typeof BUILTIN_PERSONAS[number];
