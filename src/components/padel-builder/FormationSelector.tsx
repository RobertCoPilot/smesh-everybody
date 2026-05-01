import { FORMATION_IDS, type FormationId } from '@/config/padelFormations';

interface FormationSelectorProps {
  activeFormation: FormationId;
  onChange: (formation: FormationId) => void;
}

export function FormationSelector({ activeFormation, onChange }: FormationSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Formation auswählen">
      {FORMATION_IDS.map((formation) => {
        const isActive = formation === activeFormation;
        return (
          <button
            key={formation}
            type="button"
            onClick={() => onChange(formation)}
            className={`shrink-0 border px-3 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
              isActive
                ? 'border-red-500 bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.35)]'
                : 'border-white/15 bg-white/8 text-white/60 hover:border-white/35 hover:text-white'
            }`}
          >
            {formation}
          </button>
        );
      })}
    </div>
  );
}
