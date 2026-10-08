import { completionItemProvider } from '../../io';

completionItemProvider.emptyLineProvider.push(() => [
  {
    name: '?? status == ',
    description: 'Status assert (200)',
  },
  {
    name: '?? status == 200',
    description: 'Status assert (200)',
  },
  {
    name: '?? duration <',
    description: 'Duration assert',
  },
  {
    name: '?? body contains',
    description: 'Body assert',
  },
  {
    name: '?? body matches',
    description: 'Body assert',
  },
  {
    name: '?? body md5',
    description: 'Body assert',
  },
  {
    name: '?? body sh256',
    description: 'Body assert',
  },
  {
    name: '?? body matchesFile',
    description: 'Body equals content of file (--trim, --ignoreLineEndings)',
  },
  {
    name: '?? body matchesJsonFile',
    description: 'Body equals JSON of file (--ignoreLineEndings)',
  },
  {
    name: '?? header',
    description: 'Header assert',
  },
]);
