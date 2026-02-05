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

