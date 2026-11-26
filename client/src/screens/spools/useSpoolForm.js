import { useCallback, useEffect, useRef, useState } from 'react';

const BLANK = {
  brand_id: '',
  material_id: '',
  subtype: '',
  location: '',
  color: '#ffffff',
  color_name: '',
  cost: '',
  total_weight: 1000,
  empty_weight: 250,
  used_weight: 0,
  shopify_variant_id: '',
  rfid: '',
  rfid_aliases: '',
};

export function lookupKnowledge(knowledge, brandName) {
  if (!brandName || !knowledge) return null;
  const lower = brandName.toLowerCase().trim();
  return knowledge.find((b) => b.brand.toLowerCase() === lower
    || b.brand.toLowerCase().includes(lower)
    || lower.includes(b.brand.toLowerCase())) || null;
}

/**
 * Form state for adding or editing a spool.
 * Initialises only when the form opens or the edited spool changes, never because the
 * brand, material or knowledge lists changed (that used to wipe what was typed).
 */
export default function useSpoolForm({ open, spool, brands, materials, knowledge }) {
  const [values, setValues] = useState(BLANK);
  const [activeKnowledge, setActiveKnowledge] = useState(null);
  const lists = useRef({ brands, materials, knowledge });
  lists.current = { brands, materials, knowledge };
  const defaultsPending = useRef(false);

  const brandName = (id) => lists.current.brands.find((b) => String(b.id) === String(id))?.name;

  useEffect(() => {
    if (!open) return;
    const { brands: bs, materials: ms, knowledge: kn } = lists.current;
    if (spool) {
      setValues({ ...BLANK, brand_id: spool.brand_id || '', material_id: spool.material_id || '', rfid: spool.rfid || '', rfid_aliases: spool.rfid_aliases || '', ...spool });
      setActiveKnowledge(lookupKnowledge(kn, bs.find((b) => String(b.id) === String(spool.brand_id))?.name));
      defaultsPending.current = false;
    } else {
      const brand = bs[0];
      const k = lookupKnowledge(kn, brand?.name);
      setValues({
        ...BLANK,
        brand_id: brand?.id || '',
        material_id: ms[0]?.id || '',
        empty_weight: k ? k.weight : (brand?.default_empty_weight || 250),
      });
      setActiveKnowledge(k);
      defaultsPending.current = !brand || !ms[0];
    }
  }, [open, spool?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lists that arrive after a new form opened fill the blanks once.
  useEffect(() => {
    if (!open || spool || !defaultsPending.current) return;
    if (!values.brand_id && brands[0]) {
      const k = lookupKnowledge(knowledge, brands[0].name);
      setActiveKnowledge(k);
      setValues((v) => ({ ...v, brand_id: brands[0].id, empty_weight: k ? k.weight : (brands[0].default_empty_weight || 250) }));
    }
    if (!values.material_id && materials[0]) setValues((v) => ({ ...v, material_id: materials[0].id }));
    if (brands.length && materials.length) defaultsPending.current = false;
  }, [open, spool, brands, materials, knowledge, values.brand_id, values.material_id]);

  const setField = useCallback((name, value) => setValues((v) => ({ ...v, [name]: value })), []);

  const setBrand = useCallback((brandId, brandOverride) => {
    const brand = brandOverride || lists.current.brands.find((b) => String(b.id) === String(brandId));
    const k = brand ? lookupKnowledge(lists.current.knowledge, brand.name) : null;
    const weight = brand ? (k ? k.weight : brand.default_empty_weight) : 250;
    setActiveKnowledge(k);
    setValues((v) => ({ ...v, brand_id: brandId, empty_weight: weight }));
  }, []);

  return { values, setField, setValues, setBrand, activeKnowledge, setActiveKnowledge, brandName };
}
