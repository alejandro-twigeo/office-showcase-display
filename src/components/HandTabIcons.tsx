import { MusicIcon, HeartFaceIcon, PeaceIcon } from "@/components/HandIcons";

/*
 * The hand-drawn icons for tab bars. At tab size their thin lines would look faint next to the
 * line icons (Games, Ranks, Polls), so they get an outline in the same colour to match the weight.
 * 3 is in drawing units (the icon is 84 across).
 */
type TabIconProps = { className?: string };
const bold = { stroke: "currentColor", strokeWidth: 3, strokeLinejoin: "round" as const };

export const MusicTabIcon = ({ className }: TabIconProps) => <MusicIcon {...bold} className={className} />;
export const HeartTabIcon = ({ className }: TabIconProps) => <HeartFaceIcon {...bold} className={className} />;
export const PeaceTabIcon = ({ className }: TabIconProps) => <PeaceIcon {...bold} className={className} />;
