require('./db.js');
const { uploadFile } = require('./../s3/s3.js');

const mongoose = require("mongoose");
const Document = require('./document.js');

const fileSchema = new mongoose.Schema({
    document: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true
    },
    // content : {
    //     type: Buffer,
    //     required: true
    // },
    s3Uploaded: {
        type: Boolean,
    },
    contentType: {
        type: String,
        required: true
    },
    metadata : {
        type: {},
        required: true
    },
    sourceLastUpdated: {
        type: Date,
    },
    noLastUpdated: {
        type: Boolean,
        default: false
    }
}, { timestamps: true} );

// fileSchema.post('save', async function (file) {
//     const fileDocument = await Document.findById(file.document);
//     const folderName = fileDocument.folder;
//     result = await uploadFile(folderName + '/' + file._id.toString(), file.content);
//     const isS3Uploaded = result?.$metadata?.httpStatusCode === 200;
//     await file.updateOne({s3Uploaded: isS3Uploaded, content: "uploaded to s3"});
// });

const File = mongoose.model("File", fileSchema);

module.exports = File;