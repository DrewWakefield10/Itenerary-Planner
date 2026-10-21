"use client";
import {useEffect,useRef,type ReactNode} from "react";
export default function ConfirmDialog({title,children,action="Delete",busy=false,onConfirm,onClose}:{title:string;children:ReactNode;action?:string;busy?:boolean;onConfirm:()=>void;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();cancel.current?.focus();return()=>previous?.focus();},[]);
  return <dialog className="editor-dialog" aria-labelledby="confirm-title" ref={ref} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><h2 id="confirm-title">{title}</h2>{children}<div className="trip-toolbar"><button className="button secondary" ref={cancel} disabled={busy} onClick={onClose}>Cancel</button><button className="button" disabled={busy} onClick={onConfirm}>{busy?"Working…":action}</button></div></dialog>;
}
