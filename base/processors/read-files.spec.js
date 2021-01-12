var path = require('canonical-path');
var mockPackage = require('../mocks/mockPackage');
var Dgeni = require('dgeni');

function tidyUp(promise, done) {
  return promise.then(
    () => done(),
    err => {
      console.log('ERROR', err.stack);
      done(err);
    }
  );
}

function createReadFilesProcessor(fileReaders, sourceFiles, basePath) {

  var dgeni = new Dgeni([mockPackage()]);
  var injector = dgeni.configureInjector();

  var processor = injector.get('readFilesProcessor');
  processor.fileReaders = fileReaders;
  processor.sourceFiles = sourceFiles;
  processor.basePath = path.resolve(__dirname, basePath);
  return processor;
}



describe('read-files doc processor', () => {

  it("should complain if a file reader is not valid", () => {
    expect(() => {
      var processor = createReadFilesProcessor([ {} ], ['docs/*'], '../fixtures');
      processor.$process();
    }).toThrowError('Invalid File Reader: It must have a name property');


    expect(() => {
      var processor = createReadFilesProcessor([ { name: 'badFileReader' } ], ['docs/*'], '../fixtures');
      processor.$process();
    }).toThrowError('Invalid File Reader: "badFileReader": It must have a getDocs property');
  });

  it('should iterate over matching files, providing fileInfo to the reader', done => {

    var mockFileReader = {
      name: 'mockFileReader',
      getDocs(fileInfo) { return [{ fileInfo2: fileInfo }]; }
    };

    processor = createReadFilesProcessor([mockFileReader], ['docs/*'], '../fixtures');

    var promise = processor.$process().then(docs => {
      expect(docs.length).toEqual(2);
      expect(docs[0].fileInfo).toEqual({
        fileReader: 'mockFileReader',
        filePath: path.resolve(processor.basePath, 'docs/a.js'),
        baseName: 'a',
        extension: 'js',
        basePath: processor.basePath,
        relativePath: 'docs/a.js',
        projectRelativePath: 'docs/a.js',
        content: '// Mock code file'
      });
      expect(docs[0].fileInfo2).toBe(docs[0].fileInfo);
      expect(docs[1].fileInfo).toEqual({
        fileReader: 'mockFileReader',
        filePath: path.resolve(processor.basePath, 'docs/b.ngdoc'),
        baseName: 'b',
        extension: 'ngdoc',
        basePath: processor.basePath,
        relativePath: 'docs/b.ngdoc',
        projectRelativePath: 'docs/b.ngdoc',
        content: 'mock documentation file'
      });
      expect(docs[1].fileInfo2).toBe(docs[1].fileInfo);
    });

    tidyUp(promise, done);
  });


  it("should accept an array of include patterns", done => {
    var mockFileReader = {
      name: 'mockFileReader',
      getDocs(fileInfo) { return [{ fileInfo2: fileInfo }]; }
    };

    processor = createReadFilesProcessor([mockFileReader], [ { include: ['docs/*'] } ], '../fixtures');

    var promise = processor.$process().then(docs => {
      expect(docs.length).toEqual(2);
      expect(docs[0].fileInfo).toEqual({
        fileReader: 'mockFileReader',
        filePath: path.resolve(processor.basePath, 'docs/a.js'),
        baseName: 'a',
        extension: 'js',
        basePath: processor.basePath,
        relativePath: 'docs/a.js',
        projectRelativePath: 'docs/a.js',
        content: '// Mock code file'
      });
      expect(docs[0].fileInfo2).toBe(docs[0].fileInfo);
      expect(docs[1].fileInfo).toEqual({
        fileReader: 'mockFileReader',
        filePath: path.resolve(processor.basePath, 'docs/b.ngdoc'),
        baseName: 'b',
        extension: 'ngdoc',
        basePath: processor.basePath,
        relativePath: 'docs/b.ngdoc',
        projectRelativePath: 'docs/b.ngdoc',
        content: 'mock documentation file'
      });
      expect(docs[1].fileInfo2).toBe(docs[1].fileInfo);
    });

    tidyUp(promise, done);
  });


  it("should complain if there is no matching file-reader", done => {
      var mockFileReader = {
        name: 'mockFileReader',
        defaultPattern: /\.js$/,
        getDocs(fileInfo) { return [{ fileInfo2: fileInfo }]; }
      };

      processor = createReadFilesProcessor([mockFileReader], ['docs/*'], '../fixtures');
      processor.$process().then(
        docs => {
          console.log('expected createReadFileProcessor to fail');
          expect(docs).toBeUndefined();
        },
        err => {
          expect(err).toMatch('No file reader found for .+b\\.ngdoc');
          done();
        });
  });


  it("should complain if the sourceFiles property is not valid", () => {
    expect(() => {
      var mockFileReader = {
        name: 'mockFileReader',
        defaultPattern: /\.js$/,
        getDocs(fileInfo) { return [{ fileInfo2: fileInfo }]; }
      };
      var processor = createReadFilesProcessor([ mockFileReader ], [ { wrong: 'docs/*'} ], '../fixtures');
      processor.$process();
    }).toThrowError('Invalid sourceFiles parameter. ' +
      'You must pass an array of items, each of which is either a string or an object of the form ' +
      '{ include: "...", basePath: "...", exclude: "...", fileReader: "..." }');
  });


  describe('fileReaders', () => {

    var mockNgDocFileReader = {
      name: 'mockNgDocFileReader',
      defaultPattern: /\.ngdoc$/,
      getDocs(fileInfo) { return [{}]; }
    };

    var mockJsFileReader = {
      name: 'mockJsFileReader',
      defaultPattern: /\.js$/,
      getDocs(fileInfo) { return [{}]; }
    };

    it("should use the first file reader that matches if none is specified for a sourceInfo", done => {

      processor = createReadFilesProcessor([mockNgDocFileReader, mockJsFileReader], ['docs/*'], '../fixtures');

      var promise = processor.$process().then(docs => {
        expect(docs[0].fileInfo.extension).toEqual('js');
        expect(docs[0].fileInfo.fileReader).toEqual('mockJsFileReader');
        expect(docs[1].fileInfo.extension).toEqual('ngdoc');
        expect(docs[1].fileInfo.fileReader).toEqual('mockNgDocFileReader');
      });

      tidyUp(promise, done);
    });

    it("should use the fileReader named in the sourceInfo, rather than try to match one", done => {
      processor = createReadFilesProcessor([mockNgDocFileReader, mockJsFileReader], [{ include: 'docs/*', fileReader: 'mockJsFileReader' }], '../fixtures');

      var promise = processor.$process().then(docs => {
        expect(docs[0].fileInfo.extension).toEqual('js');
        expect(docs[0].fileInfo.fileReader).toEqual('mockJsFileReader');
        expect(docs[1].fileInfo.extension).toEqual('ngdoc');
        expect(docs[1].fileInfo.fileReader).toEqual('mockJsFileReader');
      });

      tidyUp(promise, done);
    });
  });

  describe('exclusions', () => {
    it("should exclude files that match the exclude property of a sourceInfo", done => {

      var mockFileReader = {
        name: 'mockFileReader',
        getDocs(fileInfo) { return [{ }]; }
      };

      processor = createReadFilesProcessor([mockFileReader], [{ include: 'docs/*', exclude:'**/*.ngdoc' }], '../fixtures');

      var promise = processor.$process().then(docs => {
        expect(docs.length).toEqual(1);
        expect(docs[0].fileInfo.extension).toEqual('js');
      });
      tidyUp(promise, done);
    });

    it("should accept an array of exclusion patterns", done => {
      var mockFileReader = {
        name: 'mockFileReader',
        getDocs(fileInfo) { return [{ }]; }
      };

      processor = createReadFilesProcessor([mockFileReader], [{ include: 'docs/*', exclude:['**/*.ngdoc'] }], '../fixtures');

      var promise = processor.$process().then(docs => {
        expect(docs.length).toEqual(1);
        expect(docs[0].fileInfo.extension).toEqual('js');
      });
      tidyUp(promise, done);
    });
  });

  describe("relative paths", () => {
    it("should set the relativePath on the doc.fileInfo property correctly", done => {

      var mockFileReader = {
        name: 'mockFileReader',
        getDocs(fileInfo) { return [{ }]; }
      };

      processor = createReadFilesProcessor([mockFileReader], [{ include: 'src/**/*', basePath:'src' }], '../fixtures');

      var promise = processor.$process().then(docs => {
        expect(docs.length).toEqual(2);
        expect(docs[0].fileInfo.relativePath).toEqual('f1/a.js');
        expect(docs[1].fileInfo.relativePath).toEqual('f2/b.js');
      });

      tidyUp(promise, done);
    });
  });
});