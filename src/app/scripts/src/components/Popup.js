import React from 'react';
import { Box } from '@mui/material';

import '../../../styles/app-styles.css';

const Popup = ({ open, children }) => {
	return open ? (
		<Box
			sx={{
				position: 'fixed',
				top: 0,
				left: 0,
				width: '100%',
				height: '100vh',
				backgroundColor: 'rgba(0, 0, 0, 0.4)',
				zIndex: 100,
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
			}}
		>
			<Box
				sx={{
					position: 'relative',
					padding: '1rem',
					backgroundColor: 'white',
					borderRadius: '10px',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					textAlign: 'center',
					textOverflow: 'ellipsis',
					width: { xs: '90%', sm: '75%', md: '65%', lg: '30%' },
				}}
			>
				{children}
			</Box>
		</Box>
	) : (
		''
	);
};

export default Popup;
