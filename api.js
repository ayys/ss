import { getJobs, getJob } from "./base.js";

var jobs = [];

getJobs().then(function (data) {
    for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
        var j = data_1[_i];
        loop(j.rq_id);
    }
});

function loop(rq_id) {
    var count = 0;
    getJob(rq_id).then(function (data) {
        if (data.is_complete == false && count < 20) {
            count++;
            console.log("WAITING", data);
            setTimeout(function () { return loop(rq_id); }, 2000);
        }
        else
            console.log("JOB " + rq_id + " COMPLETED", data);
    });
}
