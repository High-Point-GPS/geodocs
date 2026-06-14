import React, { useMemo, useState, useEffect } from 'react';
import { TreeSelect } from 'primereact/treeselect';
import { PrimeReactProvider } from 'primereact/api';

import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';

// PrimeReact base + theme, then our overrides — all `?global` so they are NOT
// sandbox-prefixed (the dropdown panel renders at document.body). See groupTreeSelect.css.
import 'primereact/resources/themes/lara-light-blue/theme.css?global';
import 'primereact/resources/primereact.min.css?global';
import 'primeicons/primeicons.css?global';
import './groupTreeSelect.css?global';

// Total number of groups nested under this one (recursive) — shown as the count badge.
const countDescendants = (group) => {
    const kids = group.childrenList || [];
    return kids.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
};

// The geotab group tree (formatGroups output: roots with nested `childrenList`, each
// carrying a `checked` flag that is our selection seed) is converted to PrimeReact
// TreeNodes. We keep lookup maps so selection can be translated back to the existing
// upload contract (an array of selected group objects with their `childrenList`).
const buildTree = (groupData) => {
    const keyToGroup = new Map();
    const parentOf = new Map();
    const childKeysOf = new Map();
    const allParentKeys = [];
    const usedKeys = new Set();

    const makeKey = (group) => {
        const base = group.value != null ? `g:${group.value}` : `g:${group.label}`;
        let key = base;
        let n = 1;
        while (usedKeys.has(key)) key = `${base}#${n++}`;
        usedKeys.add(key);
        return key;
    };

    const convert = (group, parentKey) => {
        const key = makeKey(group);
        keyToGroup.set(key, group);
        parentOf.set(key, parentKey);
        const children = (group.childrenList || []).map((child) => convert(child, key));
        childKeysOf.set(key, children.map((c) => c.key));
        if (children.length) allParentKeys.push(key);
        return {
            key,
            label: group.label,
            data: { value: group.value, count: countDescendants(group), hasChildren: children.length > 0 },
            children,
        };
    };

    const nodes = (Array.isArray(groupData) ? groupData : []).map((g) => convert(g, null));

    // Signature of the seeded (checked) nodes so the picker re-seeds only when the
    // incoming selection actually changes (initial load, edit rehydration, clear).
    const checked = [];
    keyToGroup.forEach((g, k) => {
        if (g.checked === true) checked.push(k);
    });
    checked.sort();

    return { nodes, keyToGroup, parentOf, childKeysOf, allParentKeys, checkedSignature: checked.join('|') };
};

const GroupSelect = ({ groupData, onUpdateData, uploadType, forceClear }) => {
    const disabled = uploadType !== 'uploadGroup';

    const { nodes, keyToGroup, parentOf, childKeysOf, allParentKeys, checkedSignature } = useMemo(
        () => buildTree(groupData),
        [groupData]
    );

    const [selectionKeys, setSelectionKeys] = useState({});
    const [expandedKeys, setExpandedKeys] = useState({});

    // Seed selection from the tree's `checked` flags. Runs on the initial tree and
    // whenever that seed changes (edit rehydration, clear) — never mid-selection, so a
    // user's in-progress choices are preserved.
    useEffect(() => {
        const sel = {};
        const markSubtree = (key) => {
            sel[key] = { checked: true, partialChecked: false };
            (childKeysOf.get(key) || []).forEach(markSubtree);
        };
        keyToGroup.forEach((g, k) => {
            if (g.checked === true) markSubtree(k);
        });
        // Bubble partial/checked state up to ancestors (postorder).
        const visit = (node) => {
            const kids = node.children || [];
            kids.forEach(visit);
            if (!kids.length || sel[node.key]?.checked) return;
            const allChecked = kids.every((c) => sel[c.key]?.checked);
            const anySelected = kids.some((c) => sel[c.key]?.checked || sel[c.key]?.partialChecked);
            if (allChecked) sel[node.key] = { checked: true, partialChecked: false };
            else if (anySelected) sel[node.key] = { checked: false, partialChecked: true };
        };
        nodes.forEach(visit);
        setSelectionKeys(sel);
    }, [checkedSignature]);

    useEffect(() => {
        if (forceClear) setSelectionKeys({});
    }, [forceClear]);

    const isChecked = (value, key) => value[key] && value[key].checked === true;

    // The picker reports only the "top-most" fully-checked groups (a checked node whose
    // parent isn't checked), each with its `childrenList`. The Uploader then expands that
    // to the full descendant set — same contract the old tree-select produced.
    const topMostChecked = (value) => {
        const result = [];
        keyToGroup.forEach((group, key) => {
            if (isChecked(value, key)) {
                const pk = parentOf.get(key);
                if (!pk || !isChecked(value, pk)) result.push({ key, group });
            }
        });
        return result;
    };

    const handleChange = (e) => {
        const value = e.value || {};
        setSelectionKeys(value);
        onUpdateData(
            topMostChecked(value).map(({ group }) => ({
                label: group.label,
                value: group.value,
                childrenList: group.childrenList || [],
            }))
        );
    };

    const expandAll = () => {
        const all = {};
        allParentKeys.forEach((k) => {
            all[k] = true;
        });
        setExpandedKeys(all);
    };
    const collapseAll = () => setExpandedKeys({});

    const selectedChips = useMemo(
        () => topMostChecked(selectionKeys).map(({ key, group }) => ({ key, label: group.label })),
        [selectionKeys]
    );

    const nodeTemplate = (node) => {
        const count = node.data ? node.data.count : 0;
        const hasChildren = node.data && node.data.hasChildren;
        return (
            <div className="geodocs-node">
                <span className="geodocs-node-icon">
                    {hasChildren ? (
                        <FolderOutlinedIcon sx={{ fontSize: 18 }} />
                    ) : (
                        <SellOutlinedIcon sx={{ fontSize: 16 }} />
                    )}
                </span>
                <span className="geodocs-node-label">{node.label}</span>
                {count > 0 && <span className="geodocs-count">{count}</span>}
            </div>
        );
    };

    const valueTemplate = () => {
        if (disabled) {
            return <span className="geodocs-placeholder">Switch to “Upload By Group” to choose groups</span>;
        }
        if (!selectedChips.length) {
            return <span className="geodocs-placeholder">Select groups…</span>;
        }
        return (
            <div className="geodocs-chips">
                {selectedChips.map((chip) => (
                    <span key={chip.key} className="geodocs-chip">
                        <GroupsIcon sx={{ fontSize: 14 }} />
                        {chip.label}
                    </span>
                ))}
            </div>
        );
    };

    // Expand/Collapse-All toolbar pinned to the foot of the panel (the default header
    // already provides the sticky search; re-adding it here would double the filter).
    const panelFooterTemplate = () => (
        <div className="geodocs-panel-footer">
            <button type="button" className="geodocs-link-btn" onClick={expandAll}>
                <UnfoldMoreIcon sx={{ fontSize: 15, mr: '3px', verticalAlign: '-3px' }} />
                Expand all
            </button>
            <span className="geodocs-dot">·</span>
            <button type="button" className="geodocs-link-btn" onClick={collapseAll}>
                <UnfoldLessIcon sx={{ fontSize: 15, mr: '3px', verticalAlign: '-3px' }} />
                Collapse all
            </button>
        </div>
    );

    return (
        <PrimeReactProvider value={{ zIndex: { overlay: 1500 }, autoZIndex: true, ripple: false }}>
            <TreeSelect
                value={selectionKeys}
                onChange={handleChange}
                options={nodes}
                selectionMode="checkbox"
                metaKeySelection={false}
                filter
                filterPlaceholder="Search groups…"
                filterBy="label"
                expandedKeys={expandedKeys}
                onToggle={(e) => setExpandedKeys(e.value)}
                nodeTemplate={nodeTemplate}
                valueTemplate={valueTemplate}
                panelFooterTemplate={panelFooterTemplate}
                appendTo={typeof document !== 'undefined' ? document.body : undefined}
                scrollHeight="340px"
                disabled={disabled}
                className="geodocs-group-select"
                panelClassName="geodocs-group-panel"
                emptyMessage="No groups available"
            />
        </PrimeReactProvider>
    );
};

export default GroupSelect;
