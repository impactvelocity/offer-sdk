"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/utils";

/** Name + ID pair where the ID follows the name (slugified like the API) until edited by hand. */
export function useNameId(initial?: { name?: string; id?: string }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [id, setId] = useState(initial?.id ?? "");
  const [touched, setTouched] = useState(Boolean(initial?.id));
  return {
    name,
    id: touched ? id : slugify(name),
    setName,
    setId: (value: string) => {
      setTouched(true);
      setId(slugify(value));
    },
    reset: (next?: { name?: string; id?: string }) => {
      setName(next?.name ?? "");
      setId(next?.id ?? "");
      setTouched(Boolean(next?.id));
    },
  };
}

export function NameIdFields({
  state,
  namePlaceholder,
  idDescription = "Used in code and API calls. Lowercase letters, numbers and underscores.",
  idEditable = true,
}: {
  state: ReturnType<typeof useNameId>;
  namePlaceholder?: string;
  idDescription?: string;
  idEditable?: boolean;
}) {
  return (
    <>
      <Field label="Name">
        <Input autoFocus value={state.name} onChange={(e) => state.setName(e.target.value)} placeholder={namePlaceholder} />
      </Field>
      <Field label="ID" description={idEditable ? idDescription : "IDs can't be changed after creation."}>
        <Input
          value={state.id}
          onChange={(e) => state.setId(e.target.value)}
          placeholder="auto_generated"
          className="font-mono text-[13.5px]"
          readOnly={!idEditable}
        />
      </Field>
    </>
  );
}
