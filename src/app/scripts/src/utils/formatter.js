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

export const formatOptions = (data) => {
	return data.map((d) => {
		return {
			label: d,
			value: d,
		};
	});
};

export const matchGeotabData = (dataIds, dataKey, geotabData) => {
	const matchedData = dataIds.map((id) => {
		const data = geotabData[dataKey].find((d) => d.value === id);
		return data ? data : { label: id, value: id };
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

