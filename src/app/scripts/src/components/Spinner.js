import React from 'react';
import { Box } from '@mui/material';

import spinnerIcon from '../../../images/spinnerIcon.png';

/**
 * Branded loading spinner. Renders the GeoDocs badge and spins it while waiting.
 * Drop-in replacement for MUI's <CircularProgress />.
 *
 * @param {number} size  Diameter in pixels (default 40, matching CircularProgress).
 * @param {object} sx    Extra MUI sx overrides.
 */
const Spinner = ({ size = 40, sx = {} }) => (
	<Box
		component="img"
		src={spinnerIcon}
		alt="Loading…"
		role="progressbar"
		sx={{
			width: size,
			height: size,
			display: 'block',
			userSelect: 'none',
			animation: 'geodocsSpin 1s linear infinite',
			'@keyframes geodocsSpin': {
				from: { transform: 'rotate(0deg)' },
				to: { transform: 'rotate(360deg)' },
			},
			...sx,
		}}
	/>
);

export default Spinner;
