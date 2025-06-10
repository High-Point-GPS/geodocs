import React from 'react';

import DropdownTreeSelect from 'react-dropdown-tree-select';

const GroupSelect = ({ groupData, onUpdateData, uploadType }) => {
	const filterChecks = (groups, selectedNodes) => {
		groups.forEach((group) => {
			const idx = selectedNodes.findIndex((sn) => sn.label === group.label);
			const nowChecked = idx !== -1;
			group.checked = nowChecked;
			if (group.children && group.children.length > 0) {
				group.children = filterChecks(group.children, selectedNodes);
			}
		});

		return groups;
	};

	const onGroupChange = (currentNode, selectedNodes) => {
		const newGroupData = selectedNodes.map((node) => {
			return {
				label: node.label,
				value: node.value,
				childrenList: [...node.childrenList],
			};
		});

		onUpdateData(newGroupData);
	};

	return (
		<DropdownTreeSelect
			id="label"
			data={groupData}
			onChange={onGroupChange}
			keepOpenOnSelect
			keepTreeOnSearch
			className="tree-select-hpgps mdl-demo"
			disabled={uploadType !== 'uploadGroup'}
		/>
	);
};

export default React.memo(GroupSelect, (props, nextProps) => {
	if (props.uploadType !== nextProps.uploadType) {
		return false;
	}
	if (props.groupData === nextProps.groupData) {
		return true;
	}
});

//export default GroupSelect;
