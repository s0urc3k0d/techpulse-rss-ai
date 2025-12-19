import React from 'react';

interface DateSelectorProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-end bg-surface p-4 rounded-lg border border-slate-700">
      <div className="flex flex-col gap-1 w-full">
        <label className="text-xs text-slate-400 uppercase font-semibold">Du</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-full bg-dark border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        />
      </div>
      <div className="flex flex-col gap-1 w-full">
        <label className="text-xs text-slate-400 uppercase font-semibold">Au</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-full bg-dark border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        />
      </div>
    </div>
  );
};
