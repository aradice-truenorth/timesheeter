const VerticalContent: React.FunctionComponent<{children: React.ReactNode}> = (props) => {
    return (
        <div className="flex flex-col content-evenly card p-6">{props.children}</div>
    )
}
export default VerticalContent;
