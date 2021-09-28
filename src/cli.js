import arg from 'arg';
import { issue as startIssue } from './index.js';
import { populate as startPopulate } from './populate.js';

function parseArgumentsIntoOptions(rawArgs) {
 const args = arg(
   {
     '--populate': Boolean,
     '--issue': Boolean,
     '--all': Boolean,
     '-i': '--issue',
     '-p': '--populate',
     '-a': '--all',
   },
   {
     argv: rawArgs.slice(2),
   }
 );
 return {
   issue: args['--issue'] || false,
   populate: args['--populate'] || false,
   all: args['--all'] || false,
 };
}

export function cli(args) {
    let options = parseArgumentsIntoOptions(args);
    const { all, populate, issue } = options;

    switch(true) {
        case all:
            console.error("Not implemented");
            break;
        case populate:
            startPopulate();
            break;
        case issue:
            startIssue();
            break;
        default:
            console.error("No such command");
    }
   }