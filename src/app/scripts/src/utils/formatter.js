export const formatOptions = (data) => {
	return data.map((d) => {
		return {
			label: d,
			value: d,
		};
	});
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
		(v) => fetchedTrailers.findIndex((t) => t.name === v.name) === -1
	);

	const newVehicles = filteredVehicles.map((v) => `${v.name} (${v.serialNumber})`);
	const newDrives = fetchedDrivers.map((d) => `${d.firstName} ${d.lastName}`);
	const newTrailers = fetchedTrailers.map((t) => `${t.name}`);
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
		vehicles: [...formatOptions(newVehicles)],
		drivers: [...formatOptions(newDrives)],
		trailers: [...formatOptions(newTrailers)],
		groups: [...formatGroups(newGroups)],
	};
};

