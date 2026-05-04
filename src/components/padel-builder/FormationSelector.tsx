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
                ? 'app-choice-active border-transparent'
                : 'app-choice-idle border-theme bg-theme-soft hover-border-theme hover-text-primary'
            }`}
          >
            {formation}
          </button>
        );
      })}
    </div>
  );
}
