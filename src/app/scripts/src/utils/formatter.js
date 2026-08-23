// Returns display metadata for a file based on its extension:
// a short label, a "kind" used to pick an icon/preview mode, and badge colors.
export const getFileTypeMeta = (fileName = '') => {
	const ext = (String(fileName).split('.').pop() || '').toLowerCase();

	const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'];

	if (imageExts.includes(ext)) {
		return { ext, label: ext.toUpperCase(), kind: 'image', color: '#6D4AFF', bg: '#EDEAFF' };
	}
	if (ext === 'pdf') {
		return { ext, label: 'PDF', kind: 'pdf', color: '#E11D48', bg: '#FFE4E6' };
	}
	if (['doc', 'docx', 'ppt', 'pptx'].includes(ext)) {
		return { ext, label: ext.toUpperCase(), kind: 'doc', color: '#2563EB', bg: '#DBEAFE' };
	}
	if (['xls', 'xlsx', 'csv'].includes(ext)) {
		return { ext, label: ext.toUpperCase(), kind: 'sheet', color: '#15803D', bg: '#DCFCE7' };
	}
	return { ext: ext || 'file', label: (ext || 'FILE').toUpperCase(), kind: 'other', color: '#475569', bg: '#E2E8F0' };
};

// Geotab's root "Company Group" contains every other group, so when it appears in a
// list of group names the rest are redundant for display. Storage must keep the full
// expanded list (the driver app matches visibility by exact tag inclusion) — these
// helpers are for display/selection only.
export const isCompanyGroupLabel = (label) =>
	String(label).trim().toLowerCase() === 'company group';

export const collapseCompanyGroup = (labels) => {
	if (!Array.isArray(labels)) return labels || [];
	const company = labels.find((l) => isCompanyGroupLabel(l));
	return company ? [company] : labels;
};

export const formatOptions = (data) => {
	return data.map((d) => {
		return {
			label: d,
			value: d,
		};
	});
};

// An asset counts as active unless Geotab positively says otherwise: a missing activeTo
// means "no end date", and an unparseable one is not evidence of anything. Only a date in
// the past retires it. (A bare `new Date(activeTo) > new Date()` is false for undefined,
// which would silently hide every asset lacking the field.)
export const isActiveAsset = (asset) => {
	if (!asset || !asset.activeTo) return true;
	const activeTo = new Date(asset.activeTo);
	return isNaN(activeTo.getTime()) ? true : activeTo > new Date();
};

// id -> { label, archived } for every asset Geotab returned, active or not — the pickers
// take the active subset, but display names are resolved from ALL of it, so a document
// attached to a since-archived asset still shows that asset's name instead of a raw id.
// Geotab ids are unique across types, so one flat map covers vehicles, trailers, drivers.
export const buildAssetIndex = (devices = [], drivers = []) => {
	const assetIndex = {};
	devices.forEach((d) => {
		if (d && d.id && d.name) assetIndex[d.id] = { label: `${d.name}`, archived: !isActiveAsset(d) };
	});
	drivers.forEach((d) => {
		if (d && d.id) assetIndex[d.id] = { label: `${d.firstName} ${d.lastName}`, archived: !isActiveAsset(d) };
	});
	return assetIndex;
};

// Geotab entity ids are a type letter plus an opaque token — devices and trailers "b…",
// users "u…" — never anything with a space. Used only to tell an id apart from a display
// name on documents that predate the id migration.
const GEOTAB_ID_SHAPE = /^[bu][0-9A-Za-z]{1,15}$/;

// What one stored owner entry should render as, and whether to mark it archived.
//   - live asset            -> its current Geotab name
//   - archived, still returned -> its name, flagged
//   - no longer returned at all (the usual case: the fromDate search omits archived
//     assets) -> the name stored on the file, flagged when we can tell it really was an
//     asset: either the stored name differs from the raw entry, or the entry is id-shaped
//   - legacy document that stored a display name instead of an id -> itself, unflagged,
//     since a plain name is no evidence that anything was archived
export const resolveOwner = (entry, savedName, assetIndex) => {
	const hit = assetIndex && assetIndex[entry];
	if (hit) return { label: hit.label, archived: !!hit.archived };
	const saved = savedName != null && savedName !== '' ? String(savedName) : null;
	const raw = String(entry);
	const archived = (saved !== null && saved !== raw) || GEOTAB_ID_SHAPE.test(raw);
	return { label: saved || raw, archived };
};

// The noun each column uses for its own assets, so the marker reads in the column's terms.
const ARCHIVED_NOUN = { vehicles: 'device', trailers: 'trailer', drivers: 'driver' };

export const archivedLabel = (dataKey) => `Archived ${ARCHIVED_NOUN[dataKey] || 'asset'}`;

// Display form of one resolved owner: "Truck 101 (Archived device)" when archived.
export const ownerDisplay = (resolved, dataKey) =>
	resolved.archived ? `${resolved.label} (${archivedLabel(dataKey)})` : resolved.label;

// Rehydrates saved owner ids into picker selections. Archived assets are no longer in the
// options, so they resolve through the asset index instead and carry an `archived` flag —
// the flag drives how the chip renders. The label itself stays clean: the uploader stores
// selection labels as the file's ownerNames, and a marker baked in there would persist.
export const matchGeotabData = (dataIds, dataKey, geotabData, assetIndex) => {
	const matchedData = dataIds.map((id) => {
		const data = geotabData[dataKey].find((d) => d.value === id);
		if (data) return data;
		const resolved = resolveOwner(id, null, assetIndex);
		return { label: resolved.label, value: id, archived: resolved.archived };
})
return matchedData;
};



const formatGroups = (groups) => {
	const newGroups = [];

	groups.forEach((group) => {
		group.childrenList = [];
		if (group.children.length > 0) {
			let childGroup = undefined;
			group.children = group.children.map((child) => {
				childGroup = groups.findIndex((g) => g.value === child.id);

				if (childGroup !== -1) {
				}
				groups[childGroup].isChild = true;
				group.childrenList.push(groups[childGroup]);
				return groups[childGroup];
			});

			if (group.isChild === undefined) {
				newGroups.push(group);
			}
		}
	});

	return newGroups;
};

export const formatGeotabData = (
	fetchedVehicles,
	fetchedDrivers,
	fetchedTrailers,
	fetchedGroups
) => {
	const filteredVehicles = fetchedVehicles.filter(
		(v) => fetchedTrailers.findIndex((t) => t.tmpTrailerId === v.tmpTrailerId) === -1 
	);

	const newVehicles = filteredVehicles.map((v) => {
		return {
			label: `${v.name}`,
			value: v.id,
		}
	});


	const newDrives = fetchedDrivers.map((d) => {
		return {
			label: `${d.firstName} ${d.lastName}`,
			value: d.id,
		}
	});

	
	const newTrailers = fetchedTrailers.map((t) => {
		return {
			label: `${t.name}`,
			value: t.id,
		}
	});
	const newGroups = fetchedGroups.map((g) => {
		return {
			value: g.id,
			label: g.name,
			key: g.id,
			children: g.children,
			checked: false,
		};
	});

	return {
		vehicles: [...newVehicles],
		drivers: [...newDrives],
		trailers: [...newTrailers],
		groups: [...formatGroups(newGroups)],
	};
};

