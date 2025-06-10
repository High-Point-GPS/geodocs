export function generateCSV(fileTable) {
    let csvData = [['File', 'Groups', 'Vehicles', 'Drivers', 'Trailers', 'Expiry Date']];

    fileTable.forEach((fileData) => {
        csvData.push([
            fileData.fileName,
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
