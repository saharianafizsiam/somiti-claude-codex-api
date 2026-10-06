"use client";
import { useEffect, useState } from "react";
export function Toasts() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const receive = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 4000);
    };
    window.addEventListener("somiti:notice", receive);
    return () => {
      window.removeEventListener("somiti:notice", receive);
      clearTimeout(timer);
    };
  }, []);
  return message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null;
}
