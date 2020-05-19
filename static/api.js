import { getJobs } from "./base.js";
export var jobs = [];
export function loop(rq_id) {
    getJobs().then(function (data) {
        if (data.length < jobs.length) {
            location.reload();
        }
        else if (data.length > jobs.length) {
            jobs = data;
            console.log(jobs);
            // add all the new jobs to the jobs tab
        }
    });
    // getJob(rq_id).then((data: Job) => {
    // 	if (data.is_complete == false && count < 20){
    // 		count++;
    // 		console.log("WAITING", data);
    // 		setTimeout(() => loop(rq_id), 2000);
    // 	}
    // 	else console.log(`JOB ${rq_id} COMPLETED`, data);
    // });
}
