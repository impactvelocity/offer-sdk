// redirect_to @post, notice: "..." → ?notice=…  (and ?alert=…)
export function Flash({ notice, alert }: { notice?: string | string[]; alert?: string | string[] }) {
  return (
    <>
      {typeof notice === "string" && <p id="notice">{notice}</p>}
      {typeof alert === "string" && <p id="alert">{alert}</p>}
    </>
  );
}

export function ErrorExplanation({ errors, model = "post", action = "saved" }: { errors?: string[]; model?: string; action?: string }) {
  if (!errors?.length) return null;
  return (
    <div id="error_explanation">
      <h2>
        {errors.length} {errors.length === 1 ? "error" : "errors"} prohibited this {model} from being {action}:
      </h2>
      <ul>
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

/** `?notice=` for redirects. */
export const withNotice = (path: string, notice: string, key: "notice" | "alert" = "notice") =>
  `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(notice)}`;
