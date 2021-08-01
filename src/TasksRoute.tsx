import flatten from "lodash/flatten";
import sortBy from "lodash/sortBy";
import uniq from "lodash/uniq";
import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import * as Router from "react-router-dom";
import CollectionTable from "./CollectionTable";
import ElephantContext from "./ElephantContext";
import Tag, { TagKind } from "./Tag";
import { useTasks } from "./Tuning";
import Toast from "react-bootstrap/Toast";
import Form from "react-bootstrap/Form";
import Check from "./shared/Check";

const TaskPanel = observer(() => {
    let { taskName } = Router.useParams<{ taskName: string; }>();
    taskName = decodeURIComponent(taskName);
    const { collection } = React.useContext(ElephantContext);
    const { tasks } = useTasks();
    const [showCompleted, setShowCompleted] = React.useState(false);
    const collectionSubset = computed(() => {
        const result = collection.values().filter((item) => {
            const itemTasks = tasks(item);
            const match = itemTasks.find((task) => {
                const parts = task.split("] ");
                const thisTaskName = parts.pop();
                const completed = parts.pop()?.endsWith("X");
                if (completed && !showCompleted) {
                    return false;
                }
                return thisTaskName === taskName;
            });
            return match;
        });
        return result;
    });
    return <>
        <h2>Task: {taskName}</h2>
        <Toast className="m-2">
            <Toast.Body className="pb-2">
                <Check label="Show Completed" value={showCompleted} setValue={setShowCompleted} />
            </Toast.Body>
        </Toast>
        <CollectionTable collectionSubset={collectionSubset.get()} />
    </>;
});

const TasksIndex = observer(() => {
    const { collection } = React.useContext(ElephantContext);
    const { tasks } = useTasks();
    const allTasks = computed(() => uniq(flatten(collection.values().map((item) => tasks(item))).map((e) => e.split("] ").pop()!)));

    return <>
        <h2>Tasks</h2>
        {(sortBy(allTasks.get(), "name").map((task) => <Tag key={task} tag={task} kind={TagKind.task} />))}
    </>;
});

export function TasksMode() {
    let match = Router.useRouteMatch();
    return (
        <div>
            <Router.Switch>
                <Router.Route path={`${match.path}/:taskName`}>
                    <TaskPanel />
                </Router.Route>
                <Router.Route path={match.path}>
                    <TasksIndex />
                </Router.Route>
            </Router.Switch>
        </div>
    );
}
