import { html } from "@microsoft/fast-element";
import addons from "@storybook/addons";
import { STORY_RENDERED } from "@storybook/core-events";
import { VirtualizingStack as FoundationVirtualingStack } from "@microsoft/fast-foundation";
import VirtualizingStackTemplate from "./fixtures/base.html";
import "./index";

const imageItemTemplate = html`
    <fast-card style="height:100px; width:120px;">
        <image style="height:100px; width:120px;" src="${x => x}"></image>
    </fast-card>
`;

addons.getChannel().addListener(STORY_RENDERED, (name: string) => {
    if (name.toLowerCase().startsWith("virtualizing-stack")) {
        const stack1 = document.getElementById("stack1") as FoundationVirtualingStack;

        stack1.itemTemplate = imageItemTemplate;
        stack1.itemHeight = 100;
        stack1.items = newDataSet(100000);

        const stack2 = document.getElementById("stack2") as FoundationVirtualingStack;

        stack2.itemTemplate = imageItemTemplate;
        stack2.itemHeight = 100;
        stack2.items = newDataSet(100000);
    }
});

function newDataSet(rowCount: number): string[] {
    const newData: string[] = [];
    for (let i = 0; i <= rowCount; i++) {
        newData.push(`https://via.placeholder.com/120x100/414141/?text=${i + 1}`);
    }
    return newData;
}

export default {
    title: "Virtualizing Stack",
};

export const VirtualizingStack = () => VirtualizingStackTemplate;
