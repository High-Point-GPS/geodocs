export function generateCSV(fileTable) {
    let csvData = [
        ['File', 'Type', 'Uploaded By', 'Notes', 'Groups', 'Vehicles', 'Drivers', 'Trailers', 'Expiry Date'],
    ];

    fileTable.forEach((fileData) => {
        const uploadedBy = fileData.uploadedBy;
        csvData.push([
            fileData.fileName,
            fileData.documentType || '',
            // Blank means an admin uploaded it from the web app.
            uploadedBy ? uploadedBy.driverName || uploadedBy.userName || 'Driver' : '',
            fileData.description || '',
            combineData(fileData.owners.groups),
            combineData(fileData.owners.vehicles),
            combineData(fileData.owners.drivers),
            combineData(fileData.owners.trailers),
            fileData.expiryDate ? convertDateToReadable(fileData.expiryDate) : 'None (Active)'
        ]);
    });

    return csvData;
}

function combineData(arrayData) {
    return arrayData.join(', ');
}

function convertDateToReadable(iso) {
    const date = new Date(iso);
    let expired = false;

    if(date < new Date()) {
        expired = true;
    }

    return date.toLocaleDateString('en-US', {
        year:  'numeric',
        month: 'long',
        day:   'numeric'
      }) + ` (${expired ? 'Expired' : 'Active'})`
}
