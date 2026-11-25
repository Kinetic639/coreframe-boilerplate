"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VALID_TIMEZONES } from "@/lib/validations/user-preferences";

const TIMEZONE_GROUPS: Record<string, readonly string[]> = {
  Europe: VALID_TIMEZONES.filter((tz) => tz.startsWith("Europe/")),
  Americas: VALID_TIMEZONES.filter((tz) => tz.startsWith("America/")),
  Asia: VALID_TIMEZONES.filter((tz) => tz.startsWith("Asia/")),
  Oceania: [
    ...VALID_TIMEZONES.filter((tz) => tz.startsWith("Australia/")),
    ...VALID_TIMEZONES.filter((tz) => tz.startsWith("Pacific/")),
  ],
  Africa: VALID_TIMEZONES.filter((tz) => tz.startsWith("Africa/")),
  Other: ["UTC"],
};

/** Select value standing for "no zone of my own" (follow the organization). */
export const FOLLOW_ORGANIZATION = "__organization__";

interface TimeZoneSelectProps {
  id?: string;
  /** An IANA zone, or FOLLOW_ORGANIZATION when `followOrganizationLabel` is set. */
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /** Adds a first option that follows the organization's zone. */
  followOrganizationLabel?: string;
}

function label(zone: string) {
  return zone.replace(/_/g, " ");
}

export function TimeZoneSelect({
  id,
  value,
  onValueChange,
  disabled,
  followOrganizationLabel,
}: TimeZoneSelectProps) {
  const known =
    value === FOLLOW_ORGANIZATION || (VALID_TIMEZONES as readonly string[]).includes(value);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {followOrganizationLabel && (
          <>
            <SelectItem value={FOLLOW_ORGANIZATION}>{followOrganizationLabel}</SelectItem>
            <SelectSeparator />
          </>
        )}
        {!known && <SelectItem value={value}>{label(value)}</SelectItem>}
        {Object.entries(TIMEZONE_GROUPS).map(([group, zones]) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {zones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {label(tz)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
