"use client";
import {useEffect,useRef,useState} from "react";
export default function TextEditDialog({initial,onSave,onClose}:{initial:string;onSave:(value:string)=>void;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),field=useRef<HTMLInputElement>(null),[value,setValue]=useState(initial),[error,setError]=useState("");
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();field.current?.focus();return()=>previous?.focus();},[]);
  return <dialog className="editor-dialog" ref={dialog} aria-labelledby="rename-title" onCancel={onClose}><form noValidate onSubmit={e=>{e.preventDefault();if(!value.trim()){setError("Enter a trip name.");field.current?.focus();return;}onSave(value.trim());}}><h2 id="rename-title">Rename trip</h2><label>Trip name<input ref={field} maxLength={160} aria-invalid={!!error} aria-describedby={error?"rename-error":undefined} value={value} onChange={e=>setValue(e.target.value)}/></label>{error&&<p id="rename-error" role="alert">{error}</p>}<div className="trip-toolbar"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button">Update trip name</button></div></form></dialog>;
}
