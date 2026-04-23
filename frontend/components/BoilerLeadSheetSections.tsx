/**
 * Boiler lead sheet fields (paper form parity). Used when product line is Heating.
 */
import type { ReactNode } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const YN_UNSET = '_unset';

function BoilerCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300"
      />
      {label}
    </label>
  );
}

function OptionalYesNoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || YN_UNSET} onValueChange={(v) => onChange(v === YN_UNSET ? '' : v)}>
      <SelectTrigger className="border-2 border-gray-300">
        <SelectValue placeholder="Optional" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={YN_UNSET}>—</SelectItem>
        <SelectItem value="true">Yes</SelectItem>
        <SelectItem value="false">No</SelectItem>
      </SelectContent>
    </Select>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border pb-6 last:border-0">
      <h4 className="text-lg font-medium mb-4">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export function BoilerLeadSheetSections({
  form,
  update,
  inputBorderClass,
}: {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  inputBorderClass: string;
}) {
  return (
    <>
      <FormSection title="Boiler lead sheet — current boiler">
        <div className="md:col-span-2">
          <Label>Energy spend</Label>
          <p className="text-xs text-muted-foreground mb-2">Tick all that apply (Gas / Dual on the paper sheet).</p>
          <div className="flex flex-wrap gap-6">
            <BoilerCheckbox
              id="boiler_energy_gas"
              label="Gas"
              checked={form.boiler_energy_gas === 'true'}
              onChange={(c) => update('boiler_energy_gas', c ? 'true' : '')}
            />
            <BoilerCheckbox
              id="boiler_energy_dual"
              label="Dual fuel"
              checked={form.boiler_energy_dual === 'true'}
              onChange={(c) => update('boiler_energy_dual', c ? 'true' : '')}
            />
          </div>
        </div>
        <div>
          <Label>Boiler age</Label>
          <Select value={form.boiler_age || YN_UNSET} onValueChange={(v) => update('boiler_age', v === YN_UNSET ? '' : v)}>
            <SelectTrigger className={inputBorderClass}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={YN_UNSET}>—</SelectItem>
              <SelectItem value="7_10">7–10 years</SelectItem>
              <SelectItem value="over_10">Over 10 years</SelectItem>
              <SelectItem value="15_plus">15 years +</SelectItem>
              <SelectItem value="unsure">Unsure</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Type</Label>
          <Select value={form.boiler_type || YN_UNSET} onValueChange={(v) => update('boiler_type', v === YN_UNSET ? '' : v)}>
            <SelectTrigger className={inputBorderClass}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={YN_UNSET}>—</SelectItem>
              <SelectItem value="combi">Combi</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="back">Back boiler</SelectItem>
              <SelectItem value="unsure">Unsure</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fuel type</Label>
          <Select value={form.boiler_fuel || YN_UNSET} onValueChange={(v) => update('boiler_fuel', v === YN_UNSET ? '' : v)}>
            <SelectTrigger className={inputBorderClass}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={YN_UNSET}>—</SelectItem>
              <SelectItem value="oil">Oil</SelectItem>
              <SelectItem value="lpg">LPG</SelectItem>
              <SelectItem value="gas">Gas</SelectItem>
              <SelectItem value="electric">Electric</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>Boiler location</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            <BoilerCheckbox
              id="bl_k"
              label="Kitchen"
              checked={form.boiler_loc_kitchen === 'true'}
              onChange={(c) => update('boiler_loc_kitchen', c ? 'true' : '')}
            />
            <BoilerCheckbox
              id="bl_ff"
              label="First floor"
              checked={form.boiler_loc_first_floor === 'true'}
              onChange={(c) => update('boiler_loc_first_floor', c ? 'true' : '')}
            />
            <BoilerCheckbox
              id="bl_l"
              label="Loft"
              checked={form.boiler_loc_loft === 'true'}
              onChange={(c) => update('boiler_loc_loft', c ? 'true' : '')}
            />
            <BoilerCheckbox
              id="bl_g"
              label="Garage"
              checked={form.boiler_loc_garage === 'true'}
              onChange={(c) => update('boiler_loc_garage', c ? 'true' : '')}
            />
          </div>
          <div className="mt-2">
            <Label htmlFor="boiler_loc_other">Other (describe)</Label>
            <Input
              id="boiler_loc_other"
              value={form.boiler_loc_other}
              onChange={(e) => update('boiler_loc_other', e.target.value)}
              placeholder="e.g. utility room"
              className={inputBorderClass}
            />
          </div>
        </div>
        <div>
          <Label>Still working properly?</Label>
          <OptionalYesNoSelect value={form.boiler_working} onChange={(v) => update('boiler_working', v)} />
        </div>
        <div>
          <Label htmlFor="boiler_last_serviced">Last serviced</Label>
          <Input
            id="boiler_last_serviced"
            type="date"
            value={
              /^\d{4}-\d{2}-\d{2}$/.test(form.boiler_last_serviced?.trim() ?? '')
                ? form.boiler_last_serviced.trim()
                : ''
            }
            onChange={(e) => update('boiler_last_serviced', e.target.value)}
            className={inputBorderClass}
          />
          {!/^\d{4}-\d{2}-\d{2}$/.test(form.boiler_last_serviced?.trim() ?? '') &&
          (form.boiler_last_serviced?.trim() ?? '') ? (
            <p className="text-xs text-muted-foreground mt-1">
              Previous note (not a calendar date): {form.boiler_last_serviced}
            </p>
          ) : null}
        </div>
        <div>
          <Label>Boiler cover in place?</Label>
          <Select
            value={form.boiler_cover || YN_UNSET}
            onValueChange={(v) => update('boiler_cover', v === YN_UNSET ? '' : v)}
          >
            <SelectTrigger className={inputBorderClass}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={YN_UNSET}>—</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="boiler_cover_monthly">Cover monthly cost</Label>
          <Input
            id="boiler_cover_monthly"
            value={form.boiler_cover_monthly_cost}
            onChange={(e) => update('boiler_cover_monthly_cost', e.target.value)}
            placeholder="£"
            className={inputBorderClass}
          />
        </div>
        <div>
          <Label htmlFor="boiler_cover_supplier">Cover supplier</Label>
          <Input
            id="boiler_cover_supplier"
            value={form.boiler_cover_supplier}
            onChange={(e) => update('boiler_cover_supplier', e.target.value)}
            className={inputBorderClass}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="boiler_breakdowns">Breakdowns in last 12 months?</Label>
          <Input
            id="boiler_breakdowns"
            value={form.boiler_breakdowns_12m}
            onChange={(e) => update('boiler_breakdowns_12m', e.target.value)}
            placeholder="Yes / No / details"
            className={inputBorderClass}
          />
        </div>
      </FormSection>

      <FormSection title="Boiler lead sheet — issues and property">
        <div className="md:col-span-2">
          <Label>Any of the following?</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <BoilerCheckbox
              id="bi_n"
              label="Noisy"
              checked={form.boiler_issue_noisy === 'true'}
              onChange={(c) => update('boiler_issue_noisy', c ? 'true' : '')}
            />
            <BoilerCheckbox
              id="bi_l"
              label="Leaking"
              checked={form.boiler_issue_leaking === 'true'}
              onChange={(c) => update('boiler_issue_leaking', c ? 'true' : '')}
            />
            <BoilerCheckbox
              id="bi_p"
              label="Pressure issues"
              checked={form.boiler_issue_pressure === 'true'}
              onChange={(c) => update('boiler_issue_pressure', c ? 'true' : '')}
            />
            <BoilerCheckbox
              id="bi_h"
              label="Hot water runs out"
              checked={form.boiler_issue_hot_water === 'true'}
              onChange={(c) => update('boiler_issue_hot_water', c ? 'true' : '')}
            />
            <BoilerCheckbox
              id="bi_r"
              label="Not heating all rooms"
              checked={form.boiler_issue_not_all_rooms === 'true'}
              onChange={(c) => update('boiler_issue_not_all_rooms', c ? 'true' : '')}
            />
          </div>
        </div>
        <div>
          <Label>Property type</Label>
          <Select
            value={form.boiler_property_type || YN_UNSET}
            onValueChange={(v) => update('boiler_property_type', v === YN_UNSET ? '' : v)}
          >
            <SelectTrigger className={inputBorderClass}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={YN_UNSET}>—</SelectItem>
              <SelectItem value="detached">Detached</SelectItem>
              <SelectItem value="semi">Semi-detached</SelectItem>
              <SelectItem value="terraced">Terraced</SelectItem>
              <SelectItem value="flat_bungalow">Flat / Bungalow</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="boiler_bathrooms">Number of bathrooms</Label>
          <Input
            id="boiler_bathrooms"
            value={form.boiler_bathrooms}
            onChange={(e) => update('boiler_bathrooms', e.target.value)}
            className={inputBorderClass}
          />
        </div>
        <div>
          <Label>Open to free survey / quote?</Label>
          <OptionalYesNoSelect value={form.boiler_open_survey} onChange={(v) => update('boiler_open_survey', v)} />
        </div>
        <div>
          <Label>Survey booked?</Label>
          <OptionalYesNoSelect value={form.boiler_survey_booked} onChange={(v) => update('boiler_survey_booked', v)} />
        </div>
        <div>
          <Label htmlFor="boiler_agent_name">Agent name</Label>
          <Input
            id="boiler_agent_name"
            value={form.boiler_agent_name}
            onChange={(e) => update('boiler_agent_name', e.target.value)}
            className={inputBorderClass}
          />
        </div>
        <div>
          <Label htmlFor="boiler_agent_date">Date</Label>
          <Input
            id="boiler_agent_date"
            type="date"
            value={form.boiler_agent_date}
            onChange={(e) => update('boiler_agent_date', e.target.value)}
            className={inputBorderClass}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="boiler_electric">Electric (notes / spend)</Label>
          <Input
            id="boiler_electric"
            value={form.boiler_electric}
            onChange={(e) => update('boiler_electric', e.target.value)}
            placeholder="As per paper sheet"
            className={inputBorderClass}
          />
        </div>
      </FormSection>
    </>
  );
}
