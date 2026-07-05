import React, { useState } from "react";
import { ChatCircleDots, X } from "@phosphor-icons/react";
import AIChatBox from "./AIChatBox";

const AIChatButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && <AIChatBox onClose={() => setOpen(false)} />}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-4 right-4 z-50 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-200 ${
          open ? "bg-slate-700 hover:bg-slate-800" : "bg-slate-900 hover:bg-black hover:scale-105"
        }`}
        style={{ width: 52, height: 52 }}
        title="Hỏi AI về dữ liệu"
      >
        {open
          ? <X size={20} color="white" weight="bold" />
          : <ChatCircleDots size={24} color="white" weight="fill" />
        }
      </button>
    </>
  );
};

export default AIChatButton;
