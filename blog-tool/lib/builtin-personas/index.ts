import { ANN_HANDLEY } from "./ann-handley";
import { BEN_THOMPSON } from "./ben-thompson";
import { BOB_HOFFMAN } from "./bob-hoffman";
import { CARL_SAGAN } from "./carl-sagan";
import { DAVID_SEDARIS } from "./david-sedaris";
import { JASON_FRIED } from "./jason-fried";
import { KATIE_NOTOPOULOS } from "./katie-notopoulos";
import { MALCOLM_GLADWELL } from "./malcolm-gladwell";
import { MICHAEL_LEWIS } from "./michael-lewis";
import { MORGAN_HOUSEL } from "./morgan-housel";
import { PATRICK_MCKENZIE } from "./patrick-mckenzie";
import { PAUL_GRAHAM } from "./paul-graham";
import { RORY_SUTHERLAND } from "./rory-sutherland";
import { SETH_GODIN } from "./seth-godin";

export const BUILTIN_PERSONAS = [
  ANN_HANDLEY,
  BEN_THOMPSON,
  BOB_HOFFMAN,
  CARL_SAGAN,
  DAVID_SEDARIS,
  JASON_FRIED,
  KATIE_NOTOPOULOS,
  MALCOLM_GLADWELL,
  MICHAEL_LEWIS,
  MORGAN_HOUSEL,
  PATRICK_MCKENZIE,
  PAUL_GRAHAM,
  RORY_SUTHERLAND,
  SETH_GODIN,
] as const;

export type BuiltinPersona = typeof BUILTIN_PERSONAS[number];
