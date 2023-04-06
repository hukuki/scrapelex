require('./db.js');

const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
    document: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true
    },
    content : {
        type: Buffer,
        required: true
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
        required: true
    }
}, { timestamps: true} );
/*
fileSchema.post('save', function (file) {
    file.document.sourceLastUpdated = file.sourceLastUpdated;
    file.document.save();
});*/

const File = mongoose.model("File", fileSchema);

module.exports = File;