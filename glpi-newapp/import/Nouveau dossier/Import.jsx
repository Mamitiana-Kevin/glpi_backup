import React, { useState } from "react";
import {
  FileUp,
  CheckCircle,
  AlertCircle,
  FileText,
  FileArchive,
  ArrowRight,
  Info,
} from "lucide-react";
import { importData } from "../../services/backoffice/glpi";

export default function Import() {
  const [files, setFiles] = useState({
    feuille1: null,
    feuille2: null,
    feuille3: null,
    images: null,
  });
  const [status, setStatus] = useState("idle"); // idle | uploading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = (e, key) => {
    setFiles({ ...files, [key]: e.target.files[0] });
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!files.feuille1 || !files.feuille2 || !files.feuille3 || !files.images) {
      alert("Veuillez sélectionner tous les fichiers requis.");
      return;
    }
    setStatus("uploading");
    setErrorMsg("");
    try {
      await importData({
        feuille1: files.feuille1,
        feuille2: files.feuille2,
        feuille3: files.feuille3,
      });
      setStatus("success");
    } catch (err) {
      console.error("Import error:", err);
      setErrorMsg(err.response?.data?.message ?? err.message ?? "Erreur inconnue");
      setStatus("error");
    }
  };

  const FileInput = ({ label, id, icon: Icon, color }) => (
    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center gap-5 mb-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="font-bold text-slate-900">{label}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {id === "images" ? "Requis (.zip)" : "Requis (.csv)"}
          </p>
        </div>
      </div>
      <label className="block">
        <span className="sr-only">Choisir un fichier</span>
        <input
          type="file"
          accept={id === "images" ? ".zip" : ".csv"}
          onChange={(e) => handleFileChange(e, id)}
          className="block w-full text-xs text-slate-500
            file:mr-4 file:py-2.5 file:px-4
            file:rounded-xl file:border-0
            file:text-[10px] file:font-black file:uppercase file:tracking-widest
            file:bg-slate-900 file:text-white
            hover:file:bg-blue-600 transition-all cursor-pointer"
        />
      </label>
      {files[id] && (
        <div className="mt-4 flex items-center gap-2 text-blue-600 animate-fade-in">
          <CheckCircle size={14} />
          <span className="text-xs font-bold truncate">{files[id].name}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">
            Importation
          </h1>
          <p className="text-slate-500">
            Mettez à jour les données du système via les fichiers CSV et ZIP.
          </p>
        </div>
        <div className="bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm">
          <Info size={18} />
          Tous les fichiers sont obligatoires
        </div>
      </div>

      <form onSubmit={handleImport} className="space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FileInput
            label="Feuille 1 : Éléments"
            id="feuille1"
            icon={FileText}
            color="bg-blue-50 text-blue-600"
          />
          <FileInput
            label="Feuille 2 : Tickets"
            id="feuille2"
            icon={FileText}
            color="bg-indigo-50 text-indigo-600"
          />
          <FileInput
            label="Feuille 3 : Coûts"
            id="feuille3"
            icon={FileText}
            color="bg-purple-50 text-purple-600"
          />
          <FileInput
            label="Pack Images"
            id="images"
            icon={FileArchive}
            color="bg-slate-900 text-white"
          />
        </div>

        <div className="flex flex-col items-center gap-6">
          <button
            type="submit"
            disabled={status === "uploading"}
            className={`group flex items-center gap-3 px-12 py-5 rounded-3xl font-bold text-white transition-all shadow-xl ${
              status === "uploading"
                ? "bg-slate-300 cursor-not-allowed shadow-none"
                : "bg-slate-900 hover:bg-black hover:-translate-y-1 shadow-slate-200"
            }`}
          >
            {status === "uploading" ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <FileUp size={20} />
                Lancer l'importation
                <ArrowRight
                  size={18}
                  className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                />
              </>
            )}
          </button>

          {status === "success" && (
            <div className="flex items-center gap-3 text-green-600 font-bold animate-fade-in">
              <CheckCircle size={20} />
              Données importées avec succès
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-3 text-red-600 font-bold animate-fade-in">
              <AlertCircle size={20} />
              Erreur : {errorMsg}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
