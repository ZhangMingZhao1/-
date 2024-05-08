import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import debounce from 'lodash.debounce';

export default class Cooperate {
    static pluginName = 'Cooperate';
    toolOverlay = null;
    ymap = null;
    lf = null;
    ydoc = null;
    provider = null;
    awareness = null;
    userInfo = null;
    currentAwarenessData = [];
    oldAwarenessData = [];
    constructor({ lf }) {
        console.log('插件初始化');
        this.lf = lf;
        console.log('lf实例', lf);
        // Yjs文档实例
        this.ydoc = new Y.Doc();
        // 感知数据
        this.awareness = null;
        this.bindEvent();
        this.initData();
    }
    render(lf, toolOverlay) {
        this.toolOverlay = toolOverlay;
    }
    initData() {
        // 解绑原来数据
        if (this.ymap) {
            this.ymap.unobserve(this.onObserve);
        }
        // 创建共享数据(map只有set 和 delete操作)
        this.ymap = this.ydoc.getMap();
        this.ymap.observe(this.onObserve);
    }
    destroy() {
        this.unBindEvent();
    }
    setProvider(provider, webrtcProviderConfig = {}) {
        const { roomName, signalingList, ...otherConfig } =
            webrtcProviderConfig;
        this.provider =
            provider ||
            new WebrtcProvider(roomName, this.ydoc, {
                signaling: signalingList,
                ...otherConfig
            });
        this.awareness = this.provider.awareness;
        this.awareness.on('change', this.onAwareness);
    }
    setUserInfo(userInfo) {
        this.userInfo = userInfo;
    }
    bindEvent = () => {
        this.changeActionBind();
        this.nodeClickEventBind();
    };
    unBindEvent() {
        if (this.ymap) {
            this.ymap.unobserve(this.onObserve);
        }
        this.ydoc.destroy();
    }
    onAwareness = (changeDataId) => {
        console.log('changeDataId', changeDataId);
        const state = this.awareness.getStates();
        let awarenessData = [];
        const nameToDataMapArr = Array.from(
            this.awareness.getStates().values()
        );
        nameToDataMapArr.forEach((nameToDataMap) => {
            // console.log(name, nameToDataMap[name]);
            const name = Object.keys(nameToDataMap)[0];
            // 空的名字异常直接结束
            if (!name) return;
            // 自己不显示
            if (name !== this.userInfo.name) {
                awarenessData.push({
                    name,
                    nodeData: nameToDataMap[name]
                });
            }
            console.log('awarenessData', awarenessData);
        });
        this.oldAwarenessData = JSON.parse(
            JSON.stringify(this.currentAwarenessData)
        );
        this.currentAwarenessData = awarenessData;
        this.showToOthers();
        console.log(
            'old, new',
            this.oldAwarenessData,
            this.currentAwarenessData
        );
    };
    convertPostion(data) {
        const Model = this.lf.graphModel.getElement(data.id);
        let x;
        let y;
        if (Model.BaseType === 'node') {
            x = data.x + Model.width / 2;
            y = data.y - Model.height / 2;
        }
        return this.lf.graphModel.transformModel.CanvasPointToHtmlPoint([x, y]);
    }
    showToOthers = () => {
        // 重置之前的旧数据
        this.oldAwarenessData.forEach((data) => {
            const { nodeData } = data;
            const {
                nodeData: { id }
            } = nodeData;
            const dom = document.getElementsByClassName(
                'name-block'
            )[0] as HTMLDivElement;
            console.log('dom');
            dom.remove();
            // 重置节点节点
            let node = this.lf.getNodeModelById(id);
            node.setStyles({ stroke: '#000000' });
        });

        // 显示名字
        this.currentAwarenessData.forEach((data) => {
            const { name, nodeData } = data;
            const {
                nodeData: { x, y, id },
                userInfo: { color }
            } = nodeData;
            const dom = document.createElement('div');
            const [xx, yy] = this.convertPostion({ x, y, id });
            dom.classList.add('name-block');
            dom.style.position = 'absolute';
            dom.style.display = 'block';
            dom.style.top = `${yy}px`;
            dom.style.left = `${xx + 10}px`;
            dom.style.color = color;
            dom.style.fontWeight = `800`;
            dom.style.fontSize = `20px`;
            dom.innerText = `${name}`;
            this.toolOverlay.appendChild(dom);
            console.log('this.lf', this.lf);
            // 高亮节点
            let node = this.lf.getNodeModelById(id);
            node.setStyles({ stroke: color });
        });
    };
    nodeClickEventBind = () => {
        this.lf.on('node:click', ({ data }) => {
            if (this.userInfo) {
                this.awareness.setLocalStateField(this.userInfo.name, {
                    // 用户信息
                    userInfo: {
                        ...this.userInfo
                    },
                    // 当前激活的节点id列表
                    nodeData: data
                });
            }
        });
    };
    changeActionBind() {
        this.lf.on(
            'node:dnd-add,node:dnd-drag,node:dragstart,node:drag,node:drop,edge:add,edge:delete,edge:adjust,edge:exchange-node,blank:mousemove,blank:drop',
            debounce((e) => {
                // todo 做结构化区分
                const { data } = e;
                const graphData = this.lf.getGraphData();
                this.ydoc.transact(() => {
                    this.ymap.set('graphData', graphData);
                });
            }, 100)
        );
    }
    onObserve = (event) => {
        // 获取到当前同步后的数据
        const { target, transaction } = event;
        console.log('transaction', transaction.local);
        if (transaction.local) return; // 没有 origin 表示的是本地发起
        const data = target.toJSON();
        const graphData = data['graphData'];
        const json = JSON.parse(JSON.stringify(graphData));
        console.log('graphData', json);
        this.lf.render(json);
    };
}
