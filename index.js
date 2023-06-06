/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */

const { Octokit } = require("@octokit/core");
const { createProbotAuth } = require("octokit-auth-probot");
const { createAppAuth } = require("@octokit/auth-app");
const { config, composeConfigGet } = require("@probot/octokit-plugin-config");
const { scheduleConfig } = require('./config');
const  { creon } = require('creon');
const scheduler = creno();
const schedule = scheduleConfig.schedule;
const prAutoCloseDays = scheduleConfig.interval;

const ProbotOctokit = Octokit.defaults({
  authStrategy: createProbotAuth,
});

const processPull = async (pull, octokit, config, log) => {
  // if ((config.forkOnly == true) && (pull.head.repo.fork == false)) {
  //   return;
  // }
  log.info("Closed " + pull.base.repo.name + " " + pull.number)
  await octokit.issues.createComment({
    owner: pull.base.repo.owner.login,
    repo: pull.base.repo.name,
    issue_number: pull.number,
    body: config.closureComment,
  });
  return await octokit.pulls.update({
    owner: pull.base.repo.owner.login,
    repo: pull.base.repo.name,
    pull_number: pull.number,
    state: "closed"
  });
}

const processRepository = async (repository, octokit, config, log) => {
  log.info("Processing " + repository.name)
  pulls = await octokit.pulls.list({ owner: repository.owner.login, repo: repository.name})
  pulls.data.forEach(async (pull) => { await processPull(pull, octokit, config, log) })
}

    module.exports = async (app) => {
      scheduler.schedule(schedule, async () => {
        app.log.info("Started pr-auto-close bot");
        const octokit = await app.auth(process.env.INSTALLATION_ID, app.log);


        /*
        * Go get any PRs that were opened while we were not running.  Don't care about pagination
        * because the number of open PRs are in the single digits.
        */
        repositories = await octokit.apps.listReposAccessibleToInstallation();
        repositories.data.repositories.forEach(async (repository) => { await processRepository(repository, octokit, scheduleConfig, app.log) });

        /*
        * Handle PRs as they come in.
        */
        app.on(["pull_request.opened", "pull_request.reopened"], async (context) => {
          const createdAt = new Date(context.payload.pull_request.created_at);
          createdAt.setDate(createdAt.getDate() + prAutoCloseDays);
          const remainingTime = (createdAt - new Date()) / 1000;
           
          if(Math.floor(remainingTime) <= 0) {
             processPull(context.payload.pull_request, octokit, scheduleConfig, app.log);
          }
      });

    });
    scheduler.start();
};
