import { useState, useRef } from 'react';
import { FiChevronUp, FiChevronDown } from "react-icons/fi";

export default function CollapsibleCard({ title, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef(null);

  const toggleOpen = () => setIsOpen((prev) => !prev);

  return (
    <div className="mb-4 rounded-lg shadow-lg bg-white bg-opacity-10 backdrop-blur-lg border border-white border-opacity-20 transition duration-300 ease-in-out">
      
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={toggleOpen}>
        <h2 className="text-lg font-semibold">{title}</h2>
        <button>
          {isOpen ? <FiChevronUp className="w-5 h-5"/> : <FiChevronDown className="w-5 h-5"/>}
        </button>
      </div>

      <div
        ref={contentRef}
        style={{ maxHeight: isOpen ? contentRef.current?.scrollHeight : 0 }}
        className="overflow-hidden transition-all duration-300 ease-in-out"
      >
        <div className="px-4 pb-4 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
