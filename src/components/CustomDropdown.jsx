import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const CustomDropdown = ({ 
  icon: Icon,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  multiple = false,
  showSelectedSummary = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');

  const selectedValuesSet = useMemo(() => {
    if (!multiple) return null;
    if (value == null) return new Set();
    if (Array.isArray(value)) return new Set(value);
    if (value instanceof Set) return new Set(value);
    return new Set([value]);
  }, [multiple, value]);

  const selectedLabel = useMemo(() => {
    if (!multiple) {
      return options.find(opt => opt.value === value)?.label || placeholder;
    }

    const selectedOptions = options.filter(opt => selectedValuesSet?.has(opt.value));
    if (!selectedOptions.length) return placeholder;
    if (!showSelectedSummary) return selectedOptions.map(o => o.label).join(', ');
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    return `${selectedOptions.length} selected`;
  }, [multiple, options, selectedValuesSet, value, placeholder, showSelectedSummary]);

  const toggleDropdown = useCallback(() => setIsOpen(v => !v), []);

  const handleSelect = useCallback((optionValue) => {
    if (!multiple) {
      onChange(optionValue);
      setIsOpen(false);
      return;
    }

    const prevSet = selectedValuesSet || new Set();
    const nextSet = new Set(prevSet);
    if (nextSet.has(optionValue)) nextSet.delete(optionValue);
    else nextSet.add(optionValue);

    onChange(Array.from(nextSet));
  }, [multiple, onChange, selectedValuesSet]);

  // Close on outside click and reset search
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const lowerQ = searchQuery.toLowerCase();
    return options.filter(o => String(o.label).toLowerCase().includes(lowerQ));
  }, [options, searchQuery]);

  return (
    <div className={`custom-dropdown-wrapper ${isOpen ? 'is-open' : ''}`} ref={dropdownRef}>
      <button 
        className={`dropdown-trigger ${isOpen ? 'open' : ''}`}
        onClick={toggleDropdown}
        aria-expanded={isOpen}
        type="button"
      >
        {Icon && <Icon className="dropdown-icon" size={16} />}
        <span className="dropdown-value" style={{fontSize:'12px'}}>{selectedLabel}</span>
        <ChevronDown className="dropdown-arrow" size={16} />
      </button>
      
      {isOpen && (
        <ul className="dropdown-list">
          {options.length > 5 && (
            <li className="dropdown-search-wrapper" style={{ padding: '8px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, backgroundColor: 'var(--bg-elevated)', zIndex: 2 }}>
              <input 
                type="text" 
                placeholder="Search filters..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-1)',
                  fontSize: '12px',
                  outline: 'none'
                }}
                autoFocus
              />
            </li>
          )}
          {filteredOptions.length === 0 ? (
            <li className="dropdown-item" style={{color:'var(--text-3)', fontStyle:'italic', padding: '12px', textAlign: 'center'}}>No results found</li>
          ) : filteredOptions.map((option) => {
            const checked = multiple ? !!selectedValuesSet?.has(option.value) : option.value === value;
            return (
              <li 
                key={option.value}
                className={`dropdown-item ${checked ? 'active' : ''}`}
                onClick={() => handleSelect(option.value)}
                style={{fontSize:'14px'}}
              >
                {multiple && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 10 }}>
                    {checked ? <Check size={14} /> : <span style={{ width: 14, height: 14, display: 'inline-block' }} />}
                  </span>
                )}
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CustomDropdown;

